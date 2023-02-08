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
import { createQuota, getAllQuotasByClient, sumQuotas } from "../../../quota";
import {
  createRegisteredNode,
  getEligibleNode,
  getRegisteredNode,
  getRegisteredNodes,
  getRewardForNode,
} from "../../../registered-node";
import { CreateRegisteredNode } from "../../../registered-node/dto";
import { createLogger } from "../../../utils";

const log = createLogger(["entry-server", "router", "v1"]);

// base amount of reward that a node will receive after completing a request
const BASE_EXTRA = 1;

// client id fto fund trial clients
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

const isListSafe = (value: string) => {
  // check that the list only has ids and commas
  const noSpecialCharsRegex = /^[a-zA-Z0-9]+$/;
  if (noSpecialCharsRegex.test(value)) return true;

  const alphanumericCommaRegex = /^[a-zA-Z0-9,]+$/;
  return alphanumericCommaRegex.test(value);
};

// Express Router
export const v1Router = (ops: {
  db: DBInstance;
  baseQuota: number;
  fundingServiceApi: FundingServiceApi;
}) => {
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
        return res.status(500).json({ body: "Unexpected error" });
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
        return res.status(500).json({ body: "Unexpected error" });
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
        return res.status(500).json({ body: "Unexpected error" });
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
      return res.status(500).json({ body: "Unexpected error" });
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
        } else if (dbClient.payment === "trial") {
          // update client to premium of it was previously trial
          await updateClient(ops.db, { ...dbClient, payment: "premium" });
        }
        const createdQuota = await createQuota(ops.db, {
          clientId: dbClient.id,
          quota,
          actionTaker: "discovery-platform",
        });
        return res.json({ quota: createdQuota });
      } catch (e) {
        log.error("Can not create funds", e);
        return res.status(500).json({ body: "Unexpected error" });
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
        return res.json({ client: trialClient.id });
      } catch (e) {
        log.error("Can not create trial client", e);
        return res.status(500).json({ body: "Unexpected error" });
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

        // set db client to trial client if it is in trial mode
        if (dbClient?.payment === "trial") {
          dbClient = await getClient(ops.db, TRIAL_CLIENT_ID);
        }

        if (!dbClient) {
          log.verbose("db client does not exist", client);
          return res.status(404).json({
            body: "Client does not exist",
          });
        }

        // check if client has enough quota
        const doesClientHaveQuotaResponse = await doesClientHaveQuota(
          ops.db,
          dbClient.id,
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
          return res.status(404).json({ body: "Could not find eligible node" });
        }

        // calculate how much should be funded to entry node
        const amountToFund = getRewardForNode(
          ops.baseQuota,
          BASE_EXTRA,
          selectedNode
        );
        // fund entry node
        await ops.fundingServiceApi.requestFunds({
          amount: amountToFund,
          node: selectedNode,
        });

        // create negative quota (showing that the client has used up initial quota)
        await createQuota(ops.db, {
          clientId: dbClient.id,
          quota: ops.baseQuota * -1,
          actionTaker: "discovery platform",
        });
        return res.json({
          ...selectedNode,
          accessToken: selectedNode.hoprd_api_token,
        });
      } catch (e) {
        log.error("Can not retrieve entry node", e);
        return res.status(500).json({ body: "Unexpected error" });
      }
    }
  );

  return router;
};

export const doesClientHaveQuota = async (
  db: DBInstance,
  client: string,
  baseQuota: number
) => {
  const allQuotasFromClient = await getAllQuotasByClient(db, client);
  const sumOfClientsQuota = sumQuotas(allQuotasFromClient);
  return sumOfClientsQuota >= baseQuota;
};
