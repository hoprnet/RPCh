import express, { Request, Response } from "express";
import {
  ParamSchema,
  body,
  checkSchema,
  param,
  query,
  validationResult,
} from "express-validator";
import {
  createClient,
  createTrialClient,
  getClient,
  updateClient,
} from "../../../client";
import { DBInstance } from "../../../db";
import { FundingServiceApi } from "../../../funding-service-api";
import { createQuota, getQuotasPaidByClient, sumQuotas } from "../../../quota";
import {
  createRegisteredNode,
  getEligibleNode,
  getRegisteredNode,
  getRegisteredNodes,
  getRewardForNode,
} from "../../../registered-node";
import { CreateRegisteredNode } from "../../../registered-node/dto";
import { createLogger, isListSafe } from "../../../utils";
import { Registry } from "prom-client";
import { createCounter, createGauge } from "../../../metrics";

const log = createLogger(["entry-server", "router", "v1"]);

// base amount of reward that a node will receive after completing a request
const BASE_EXTRA = BigInt(1);

// payment mode when quota is paid by trial
const TRIAL_PAYMENT_MODE = "trial";

// client id that will pay for quotas in trial mode
const TRIAL_CLIENT_ID = "trial";

// Sanitization and Validation
const registerNodeSchema: Record<keyof CreateRegisteredNode, ParamSchema> = {
  peerId: {
    in: "body",
    exists: {
      errorMessage: "Expected peerId to be in the body",
      bail: true,
    },
    isString: true,
  },
  chainId: {
    in: "body",
    exists: {
      errorMessage: "Expected chainId to be in the body",
      bail: true,
    },
    isNumeric: true,
    toInt: true,
  },
  exitNodePubKey: {
    in: "body",
    exists: {
      errorMessage: "Expected exitNodePubKey to be in the body",
      bail: true,
    },
    isString: true,
  },
  hasExitNode: {
    in: "body",
    exists: {
      errorMessage: "Expected hasExitNode to be in the body",
      bail: true,
    },
    isBoolean: true,
    toBoolean: true,
  },
  hoprdApiEndpoint: {
    in: "body",
    exists: {
      errorMessage: "Expected hoprdApiEndpoint to be in the body",
      bail: true,
    },
    isString: true,
  },
  hoprdApiToken: {
    in: "body",
    exists: {
      errorMessage: "Expected hoprdApiToken to be in the body",
      bail: true,
    },
    isString: true,
  },
  nativeAddress: {
    in: "body",
    exists: {
      errorMessage: "Expected nativeAddress to be in the body",
      bail: true,
    },
    isString: true,
  },
};

const getNodeSchema: Record<
  keyof { excludeList?: string; hasExitNode?: string },
  ParamSchema
> = {
  excludeList: {
    optional: true,
    in: "query",
    custom: {
      options: (value) => {
        return isListSafe(value);
      },
    },
  },
  hasExitNode: {
    optional: true,
    in: "query",
    isBoolean: true,
  },
};

// Express Router
export const v1Router = (ops: {
  db: DBInstance;
  baseQuota: bigint;
  fundingServiceApi: FundingServiceApi;
  register: Registry;
}) => {
  // Metrics
  const counterFetchedEntryNode = createCounter(
    ops.register,
    "counter_fetched_entry_nodes",
    "amount of entry nodes we have given to users"
  );

  const counterTrialClients = createCounter(
    ops.register,
    "counter_trial_clients",
    "amount of trial clients created through endpoint"
  );

  const counterAddedQuota = createCounter(
    ops.register,
    "counter_added_quota",
    "amount of times quota is added through endpoint"
  );

  const router = express.Router();

  router.use(express.json());

  router.post(
    "/node/register",
    checkSchema(registerNodeSchema),
    async (req: Request, res: Response) => {
      try {
        log.verbose("POST /node/register", req.body);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const node: CreateRegisteredNode = req.body;
        const registered = await createRegisteredNode(ops.db, node);
        return res.json({ body: registered });
      } catch (e) {
        log.error("Can not register node", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.get(
    "/node",
    checkSchema(getNodeSchema),
    async (
      req: Request<{}, {}, {}, { excludeList?: string; hasExitNode?: string }>,
      res: Response
    ) => {
      try {
        log.verbose("GET /node", req.query);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const { hasExitNode, excludeList } = req.query;
        const nodes = await getRegisteredNodes(ops.db, {
          excludeList: excludeList?.split(", "),
          hasExitNode: hasExitNode ? hasExitNode === "true" : undefined,
        });
        return res.json(nodes);
      } catch (e) {
        log.error("Can not get nodes", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.get(
    "/node/:peerId",
    param("peerId").isAlphanumeric(),
    async (req: Request<{ peerId: string }>, res: Response) => {
      try {
        log.verbose(`GET /node/:peerId`, req.params);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const { peerId }: { peerId: string } = req.params;
        const node = await getRegisteredNode(ops.db, peerId);
        return res.json({ node });
      } catch (e) {
        log.error("Can not get node with id", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.get("/funding-service/funds", async (req, res) => {
    log.verbose(`GET /funding-service/funds`);
    try {
      const funds = await ops.fundingServiceApi.getAvailableFunds();
      return res.json({ body: funds });
    } catch (e) {
      log.error("Can not retrieve funds from funding service", e);
      return res.status(500).json({ errors: "Unexpected error" });
    }
  });

  // DISCLAIMER: can be exploited to allow client to use infinite funds
  router.post(
    "/client/quota",
    body("client").exists(),
    body("quota").exists().bail().isNumeric(),
    async (req, res) => {
      try {
        log.verbose(`POST /client/quota`, req.body);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const { client: clientId, quota } = req.body;
        // check if client exists
        let dbClient = await getClient(ops.db, clientId);
        if (!dbClient) {
          // create client id it does not exist
          dbClient = await createClient(ops.db, {
            id: clientId,
            payment: "premium",
          });
        } else if (dbClient.payment === TRIAL_CLIENT_ID) {
          // update client to premium of it was previously trial
          await updateClient(ops.db, { ...dbClient, payment: "premium" });
        }
        const createdQuota = await createQuota(ops.db, {
          clientId: dbClient.id,
          quota,
          actionTaker: "discovery-platform",
          paidBy: dbClient.id,
        });

        counterAddedQuota.inc();

        return res.json({ quota: createdQuota });
      } catch (e) {
        log.error("Can not create funds", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.get(
    "/request/trial",
    query("label")
      .optional()
      .custom((value) => isListSafe(value)),
    async (req: Request<{}, {}, {}, { label?: string }>, res: Response) => {
      try {
        log.verbose("GET /request/trial", req.query);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          log.verbose("validation error", errors.array());
          return res.status(400).json({ errors: errors.array() });
        }
        const { label } = req.query;
        // create trial client
        const trialClient = await createTrialClient(
          ops.db,
          label ? label.split(",") : []
        );

        counterTrialClients.inc();

        return res.json({ client: trialClient.id });
      } catch (e) {
        log.error("Can not create trial client", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.post(
    "/request/entry-node",
    body("client").exists(),
    body("excludeList")
      .optional()
      .custom((value) => isListSafe(value)),
    async (req, res) => {
      try {
        log.verbose(`POST /request/entry-node`, req.body);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          log.verbose("validation error", errors.array());
          return res.status(400).json({ errors: errors.array() });
        }
        const { client, excludeList } = req.body;

        let dbClient = await getClient(ops.db, client);

        if (!dbClient) {
          log.verbose("db client does not exist", client);
          return res.status(404).json({
            errors: "Client does not exist",
          });
        }

        const clientIsTrialMode = dbClient?.payment === TRIAL_PAYMENT_MODE;
        // set who is going to pay for quota
        const paidById = clientIsTrialMode ? TRIAL_CLIENT_ID : dbClient?.id;

        // check if client has enough quota
        const doesClientHaveQuotaResponse = await doesClientHaveQuota(
          ops.db,
          paidById,
          ops.baseQuota
        );

        if (!doesClientHaveQuotaResponse) {
          return res.status(403).json({
            body: "Client does not have enough quota",
          });
        }
        // choose selected entry node
        const selectedNode = await getEligibleNode(ops.db, { excludeList });
        log.verbose("selected entry node", selectedNode);
        if (!selectedNode) {
          return res
            .status(404)
            .json({ errors: "Could not find eligible node" });
        }

        // DISCLAIMER: ACTIVATE THIS WHEN FUNDING IS STABLE
        // // calculate how much should be funded to entry node
        // const amountToFund = getRewardForNode(
        //   ops.baseQuota,
        //   BASE_EXTRA,
        //   selectedNode
        // );

        // // fund entry node
        // await ops.fundingServiceApi.requestFunds({
        //   amount: amountToFund,
        //   node: selectedNode,
        // });

        // create negative quota (showing that the client has used up initial quota)
        await createQuota(ops.db, {
          clientId: dbClient.id,
          quota: ops.baseQuota * BigInt(-1),
          actionTaker: "discovery platform",
          paidBy: paidById,
        });

        counterFetchedEntryNode.inc();

        return res.json({
          ...selectedNode,
          accessToken: selectedNode.hoprd_api_token,
        });
      } catch (e) {
        log.error("Can not retrieve entry node", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  return router;
};

export const doesClientHaveQuota = async (
  db: DBInstance,
  client: string,
  baseQuota: bigint
) => {
  const allQuotasFromClient = await getQuotasPaidByClient(db, client);
  const sumOfClientsQuota = sumQuotas(allQuotasFromClient);
  return sumOfClientsQuota >= baseQuota;
};
