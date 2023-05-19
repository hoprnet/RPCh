import express, { Request, Response } from "express";
import {
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
import { DBInstance, deleteRegisteredNode } from "../../../db";
import { FundingServiceApi } from "../../../funding-service-api";
import { createQuota } from "../../../quota";
import {
  createRegisteredNode,
  getEligibleNode,
  getRegisteredNode,
  getRegisteredNodes,
} from "../../../registered-node";
import { ClientDB, RegisteredNode, RegisteredNodeDB } from "../../../types";
import { createLogger, isListSafe } from "../../../utils";
import { errors } from "pg-promise";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as constants from "../../../constants";
import { getNodeSchema, registerNodeSchema } from "./schema";
import {
  clientExists,
  doesClientHaveQuota,
  getCache,
  metricMiddleware,
  setCache,
} from "./middleware";

const log = createLogger(["entry-server", "router", "v1"]);

// Express Router
export const v1Router = (ops: {
  db: DBInstance;
  baseQuota: bigint;
  fundingServiceApi: FundingServiceApi;
  metricManager: MetricManager;
  secret: string;
}) => {
  // Metrics
  const counterSuccessfulRequests = ops.metricManager.createCounter(
    "counter_successful_request",
    "amount of successful requests discovery platform has processed",
    { labelNames: ["method", "path", "status"] }
  );

  const counterFailedRequests = ops.metricManager.createCounter(
    "counter_failed_request",
    "amount of failed requests discovery platform has processed",
    { labelNames: ["method", "path", "status"] }
  );

  const requestDurationHistogram = ops.metricManager.createHistogram(
    "request_duration_seconds",
    "duration of requests in seconds",
    {
      buckets: [0.1, 0.5, 1, 5, 10, 30],
      labelNames: ["method", "path", "status", "client"],
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
    metricMiddleware(requestDurationHistogram),
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
    metricMiddleware(requestDurationHistogram),
    checkSchema(getNodeSchema),
    getCache(), // check if response is in cache
    async (
      req: Request<
        {},
        {},
        {},
        {
          excludeList?: string;
          hasExitNode?: string;
          status?: RegisteredNodeDB["status"];
        }
      >,
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
        const { hasExitNode, excludeList, status } = req.query;
        const nodes = await getRegisteredNodes(ops.db, {
          excludeList: excludeList?.split(", "),
          hasExitNode: hasExitNode ? hasExitNode === "true" : undefined,
          status,
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
    metricMiddleware(requestDurationHistogram),
    param("peerId").isAlphanumeric(),
    clientExists(ops.db),
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
    metricMiddleware(requestDurationHistogram),
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

  router.post(
    "/client/quota",
    metricMiddleware(requestDurationHistogram),
    header("x-secret-key")
      .exists()
      .custom((val) => val === ops.secret),
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

  router.delete(
    "/request/entry-node/:id",
    metricMiddleware(requestDurationHistogram),
    header("x-secret-key")
      .exists()
      .custom((val) => val === ops.secret),
    param("id").isAlphanumeric(),
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty()) {
          counterFailedRequests
            .labels({ method: req.method, path: req.path, status: 400 })
            .inc();
          return res.status(400).json({ errors: validationErrors.array() });
        }
        const { id }: { id: string } = req.params;
        const node = await deleteRegisteredNode(ops.db, id);
        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();
        return res.json({ node });
      } catch (e) {
        log.error("Can not delete registered_node", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  router.get(
    "/request/trial",
    metricMiddleware(requestDurationHistogram),
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
    metricMiddleware(requestDurationHistogram),
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
        let { excludeList, client } = req.body;

        if (!client) {
          // check if client was sent in headers
          client = req.headers["x-rpch-client"] as string;
        }

        if (!client) {
          return res
            .status(400)
            .json({ errors: "client was not sent in request" });
        }

        let dbClient = await getClient(ops.db, client);

        const clientIsTrialMode =
          dbClient?.payment === constants.TRIAL_PAYMENT_MODE;
        // set who is going to pay for quota
        const paidById = clientIsTrialMode
          ? constants.TRIAL_CLIENT_ID
          : dbClient?.id;

        // // check if client has enough quota
        // const doesClientHaveQuotaResponse = await doesClientHaveQuota(
        //   ops.db,
        //   paidById,
        //   ops.baseQuota
        // );

        // if (!doesClientHaveQuotaResponse) {
        //   return res.status(403).json({
        //     body: "Client does not have enough quota",
        //   });
        // }

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

        // TODO: ACTIVATE THIS WHEN FUNDING IS STABLE
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
