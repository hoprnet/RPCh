import express, { NextFunction, Request, Response } from "express";
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
import { createQuota, getSumOfQuotasPaidByClient } from "../../../quota";
import {
  createRegisteredNode,
  getEligibleNode,
  getRegisteredNode,
  getRegisteredNodes,
} from "../../../registered-node";
import { ClientDB, RegisteredNode } from "../../../types";
import { createLogger, isListSafe } from "../../../utils";
import { Histogram, Registry } from "prom-client";
import { createCounter, createHistogram } from "../../../metric";
import memoryCache from "memory-cache";
import { errors } from "pg-promise";

const log = createLogger(["entry-server", "router", "v1"]);

// payment mode when quota is paid by trial
const TRIAL_PAYMENT_MODE = "trial";

// client id that will pay for quotas in trial mode
const TRIAL_CLIENT_ID = "trial";

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

// middleware that will track duration of request
export const requestDurationMiddleware =
  (histogramMetric: Histogram<string>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();
    res.on("finish", () => {
      const end = process.hrtime(start);
      const durationSeconds = end[0] + end[1] / 1e9;
      const statusCode = res.statusCode.toString();
      const method = req.method;
      const path = req.path;
      histogramMetric.labels(method, path, statusCode).observe(durationSeconds);
    });
    next();
  };

// Express Router
export const v1Router = (ops: {
  db: DBInstance;
  baseQuota: bigint;
  fundingServiceApi: FundingServiceApi;
  register: Registry;
}) => {
  // Metrics
  const counterSuccessfulRequests = createCounter(
    ops.register,
    "counter_successful_request",
    "amount of successful requests discovery platform has processed",
    { labelNames: ["method", "path", "status"] }
  );

  const counterFailedRequests = createCounter(
    ops.register,
    "counter_failed_request",
    "amount of failed requests discovery platform has processed",
    { labelNames: ["method", "path", "status"] }
  );

  const requestDurationHistogram = createHistogram(
    ops.register,
    "request_duration_seconds",
    "duration of requests in seconds",
    {
      buckets: [0.1, 0.5, 1, 5, 10, 30],
      labelNames: ["method", "path", "status"],
    }
  );

  const router = express.Router();

  router.use(express.json());

  // log entry calls
  router.use((req, _res, next) => {
    const { method, path, params, body } = req;
    log.verbose(`${method.toUpperCase()} ${path}`, {
      params,
      body,
    });
    next();
  });

  router.post(
    "/node/register",
    requestDurationMiddleware(requestDurationHistogram),
    checkSchema(registerNodeSchema),
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          counterFailedRequests
            .labels({ method: req.method, path: req.path, status: 400 })
            .inc();
          return res.status(400).json({ errors: errors.array() });
        }
        const node: RegisteredNode = req.body;
        const registered = await createRegisteredNode(ops.db, node);
        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();
        return res.json({ body: registered });
      } catch (e) {
        log.error("Can not register node", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.get(
    "/node",
    requestDurationMiddleware(requestDurationHistogram),
    checkSchema(getNodeSchema),
    getCache(), // check if response is in cache
    async (
      req: Request<{}, {}, {}, { excludeList?: string; hasExitNode?: string }>,
      res: Response
    ) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          counterFailedRequests
            .labels({ method: req.method, path: req.path, status: 400 })
            .inc();
          return res.status(400).json({ errors: errors.array() });
        }
        const { hasExitNode, excludeList } = req.query;
        const nodes = await getRegisteredNodes(ops.db, {
          excludeList: excludeList?.split(", "),
          hasExitNode: hasExitNode ? hasExitNode === "true" : undefined,
        });
        // cache response for 1 min
        setCache(req.originalUrl || req.url, 60e3, nodes);
        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();
        return res.json(nodes);
      } catch (e) {
        log.error("Can not get nodes", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.get(
    "/node/:peerId",
    requestDurationMiddleware(requestDurationHistogram),
    param("peerId").isAlphanumeric(),
    async (req: Request<{ peerId: string }>, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          counterFailedRequests
            .labels({ method: req.method, path: req.path, status: 400 })
            .inc();
          return res.status(400).json({ errors: errors.array() });
        }
        const { peerId }: { peerId: string } = req.params;
        const node = await getRegisteredNode(ops.db, peerId);
        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();
        return res.json({ node });
      } catch (e) {
        log.error("Can not get node with id", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.get(
    "/funding-service/funds",
    requestDurationMiddleware(requestDurationHistogram),
    async (req, res) => {
      try {
        const funds = await ops.fundingServiceApi.getAvailableFunds();
        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();
        return res.json({ body: funds });
      } catch (e) {
        log.error("Can not retrieve funds from funding service", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  // DISCLAIMER: can be exploited to allow client to use infinite funds
  router.post(
    "/client/quota",
    requestDurationMiddleware(requestDurationHistogram),
    body("client").exists(),
    body("quota").exists().bail().isNumeric(),
    async (req, res) => {
      try {
        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty()) {
          counterFailedRequests
            .labels({ method: req.method, path: req.path, status: 400 })
            .inc();
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

        if (dbClient.payment === TRIAL_PAYMENT_MODE) {
          // update client to premium of it was previously trial
          await updateClient(ops.db, { ...dbClient, payment: "premium" });
        }

        const createdQuota = await createQuota(ops.db, {
          clientId: dbClient.id,
          quota,
          actionTaker: "discovery-platform",
          paidBy: dbClient.id,
        });

        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();

        return res.json({ quota: createdQuota });
      } catch (e) {
        log.error("Can not create funds", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.get(
    "/request/trial",
    requestDurationMiddleware(requestDurationHistogram),
    query("label")
      .optional()
      .custom((value) => isListSafe(value)),
    async (req: Request<{}, {}, {}, { label?: string }>, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          log.verbose("validation error", errors.array());
          counterFailedRequests
            .labels({ method: req.method, path: req.path, status: 400 })
            .inc();
          return res.status(400).json({ errors: errors.array() });
        }
        const { label } = req.query;
        // create trial client
        const trialClient = await createTrialClient(
          ops.db,
          label ? label.split(",") : []
        );

        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();

        return res.json({ client: trialClient.id });
      } catch (e) {
        log.error("Can not create trial client", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.post(
    "/request/entry-node",
    requestDurationMiddleware(requestDurationHistogram),
    body("client").exists(),
    body("excludeList")
      .optional()
      .custom((value) => isListSafe(value)),
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          log.verbose("validation error", errors.array());
          counterFailedRequests
            .labels({ method: req.method, path: req.path, status: 400 })
            .inc();
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
          counterFailedRequests
            .labels({ method: req.method, path: req.path, status: 404 })
            .inc();
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

        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();

        return res.json({
          ...selectedNode,
          accessToken: selectedNode.hoprd_api_token,
        });
      } catch (e) {
        log.error("Can not retrieve entry node", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  return router;
};
