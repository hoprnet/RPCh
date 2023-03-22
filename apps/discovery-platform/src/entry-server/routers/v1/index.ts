import express, { NextFunction, Request, Response } from "express";
import {
  ParamSchema,
  body,
  checkSchema,
  header,
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
import { FundingServiceApi } from "../../../funding-service-api";
import {
  createQuota,
  getQuotaByToken,
  getSumOfQuotasPaidByClient,
} from "../../../quota";
import {
  createRegisteredNode,
  getEligibleNode,
  getRegisteredNode,
  getRegisteredNodeWithoutApiToken,
  getRegisteredNodesWithoutApiToken,
} from "../../../registered-node";
import { ClientDB, RegisteredNode, DBInstance } from "../../../types";
import { createLogger, isListSafe } from "../../../utils";
import memoryCache from "memory-cache";
import { errors } from "pg-promise";
import { hoprd, errors as httpErrors } from "@rpch/common";
import * as constants from "../../../constants";

const log = createLogger(["entry-server", "router", "v1"]);

// Sanitization and Validation
const registerNodeSchema: Record<keyof RegisteredNode, ParamSchema> = {
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

export const getCache = () => {
  return (req: Request, res: Response<any, any>, next: NextFunction) => {
    let key = req.originalUrl || req.url;
    let cachedBody = memoryCache.get(key);
    if (cachedBody) {
      log.verbose("Returning cached value for endpoint: ", key);
      return res.json(cachedBody);
    }
    next();
  };
};

export const setCache = (key: string, duration: number, body: Object) => {
  memoryCache.put(key, body, duration);
};

// middleware used to check if client sent in req has enough quota
export const doesClientHaveQuota = async (
  db: DBInstance,
  client: string,
  baseQuota: bigint
) => {
  const sumOfClientsQuota = await getSumOfQuotasPaidByClient(db, client);
  return sumOfClientsQuota >= baseQuota;
};

// Express Router
export const v1Router = (ops: {
  db: DBInstance;
  baseQuota: bigint;
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
        const node: RegisteredNode = req.body;
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
    getCache(), // check if response is in cache
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
        const nodes = await getRegisteredNodesWithoutApiToken(ops.db, {
          excludeList: excludeList?.split(", "),
          hasExitNode: hasExitNode ? hasExitNode === "true" : undefined,
        });
        // cache response for 1 min
        setCache(req.originalUrl || req.url, 60e3, nodes);
        return res.json(nodes);
      } catch (e) {
        log.error("Can not get nodes", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.get(
    "/node/:id/refresh",
    param("id").isAlphanumeric(),
    header("x-auth-token").exists(),
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        log.verbose(`GET /node/:id/refresh`, req.params);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        // Get the ID of the node to refresh from the request params
        const { id } = req.params;

        const node = await getRegisteredNode(ops.db, id);
        // Get the current token from the request headers
        const currentToken: string = req.headers["x-auth-token"] as string;
        if (!currentToken) throw Error("missing current auth token");
        // check if token exists
        const quota = getQuotaByToken(ops.db, currentToken);
        if (!quota) throw new httpErrors.NotFoundError();
        // Delete the current node capability token
        try {
          await hoprd.deleteToken({
            apiEndpoint: node.hoprd_api_endpoint,
            apiToken: node.hoprd_api_token,
            tokenToDelete: currentToken,
          });
          // do nothing if token failed to delete
        } catch {}
        // request new token
        const newToken = await hoprd.createToken({
          apiEndpoint: node.hoprd_api_endpoint,
          apiToken: node.hoprd_api_token,
          description: "access token for SDK",
          tokenCapabilities: constants.USER_HOPRD_TOKEN_CAPABILITIES,
          maxCalls: Number(ops.baseQuota),
        });
        log.verbose("received new token: ", newToken);
        // TODO: REDUCE QUOTA -> WHAT CLIENT? -> ADD COLUMN TO DB
        return res.json({
          token: newToken,
        });
      } catch (e) {
        log.error("Can not refresh token", e);
        if (e instanceof httpErrors.HttpError) {
          return res.status(e.status).json({ errors: e.message });
        }
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
        const node = await getRegisteredNodeWithoutApiToken(ops.db, peerId);
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
        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty()) {
          return res.status(400).json({ errors: validationErrors.array() });
        }
        const { client: clientId, quota } = req.body;
        let dbClient: ClientDB | undefined;

        // check if client exists
        try {
          dbClient = await getClient(ops.db, clientId);
        } catch (e) {
          if (e instanceof errors.QueryResultError) {
            dbClient = await createClient(ops.db, {
              id: clientId,
              payment: "premium",
            });
          }
        }

        if (!dbClient) throw Error("Could not create Client");

        if (dbClient.payment === constants.TRIAL_PAYMENT_MODE) {
          // update client to premium of it was previously trial
          await updateClient(ops.db, { ...dbClient, payment: "premium" });
        }

        const createdQuota = await createQuota(ops.db, {
          clientId: dbClient.id,
          quota,
          actionTaker: "discovery-platform",
          paidBy: dbClient.id,
        });

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

        const clientIsTrialMode =
          dbClient?.payment === constants.TRIAL_PAYMENT_MODE;
        // set who is going to pay for quota
        const paidById = clientIsTrialMode
          ? constants.TRIAL_CLIENT_ID
          : dbClient?.id;

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
