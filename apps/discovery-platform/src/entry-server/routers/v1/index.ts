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
import type {
  ClientDB,
  RegisteredNode,
  RegisteredNodeDB,
  AvailabilityMonitorResult,
} from "../../../types";
import { createLogger, isListSafe } from "../../../utils";
import { errors } from "pg-promise";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as constants from "../../../constants";
import { getNodeSchema, registerNodeSchema } from "./schema";
import {
  clientExists,
  // doesClientHaveQuota,
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
  getAvailabilityMonitorResults: () => Map<string, AvailabilityMonitorResult>;
}) => {
  /** @return an array of unstable peer ids */
  function getUnstableNodes() {
    return Array.from(ops.getAvailabilityMonitorResults().entries()).reduce<
      string[]
    >((result, [peerId, { isStable }]) => {
      if (!isStable) result.push(peerId);
      return result;
    }, []);
  }

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
    getCache<RegisteredNodeDB[]>(
      (req) => req.originalUrl || req.url,
      (body) => {
        const unstableNodes = getUnstableNodes();
        return body.reduce<RegisteredNodeDB[]>((result, node) => {
          if (!unstableNodes.includes(node.id)) {
            result.push(node);
          }
          return result;
        }, []);
      }
    ), // check if response is in cache
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
        let { hasExitNode, excludeList: excludeListStr, status } = req.query;

        let excludeList: string[] = [];
        if (!excludeListStr) excludeList = [];
        else if (
          typeof excludeListStr === "string" &&
          excludeListStr.length > 0
        ) {
          excludeList = excludeListStr.split(",");
        }

        // expand 'excludeList' with unstable nodes
        const unstableNodes = getUnstableNodes();
        if (unstableNodes.length > 0) {
          log.verbose(
            "We have %i unstable nodes, adding to 'excludeList'",
            unstableNodes.length
          );
          for (const unstableNode of unstableNodes) {
            if (excludeList.includes(unstableNode)) continue;
            excludeList.push(unstableNode);
          }
        }

        const nodes = await getRegisteredNodes(ops.db, {
          excludeList,
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
        let { excludeList = [], client } = req.body as {
          excludeList: string[];
          client?: string;
        };

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

        // CAUSING OUTAGE
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

        // expand 'excludeList' with unstable nodes
        const unstableNodes = getUnstableNodes();
        if (unstableNodes.length > 0) {
          log.verbose(
            "We have unstable nodes %i, adding to 'excludeList'",
            unstableNodes.length
          );
          for (const unstableNode of unstableNodes) {
            if (excludeList.includes(unstableNode)) continue;
            excludeList.push(unstableNode);
          }
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

  router.post(
    "/request/one-hop-delivery-routes",
    metricMiddleware(requestDurationHistogram),
    body("excludeList")
      .optional()
      .custom((value) => isListSafe(value)),
    body("amount").optional().isInt({ min: 1, max: 10 }),
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
        let {
          excludeList = [],
          amount = 1,
          client,
        } = req.body as {
          excludeList: string[];
          amount: number;
          client?: string;
        };

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

        // TODO: check if client has enough quota

        // using the availability monitor results
        // we create a object keyed by WORKING entry nodes
        // linked with WORKING exit nodes which availability-monitor
        // has proven connectivity between them
        const routes = Array.from(
          ops.getAvailabilityMonitorResults().entries()
        ).reduce<{ entryNodePeerId: string; exitNodePeerIds: string[] }[]>(
          (result, [entryNodePeerId, info]) => {
            const { outgoingChannels, exitNodesToOutgoingChannels } =
              info.connectivityReview;
            const intermediatePeerIds: string[] = [];
            const exitNodePeerIds: string[] = [];

            // entry nodes must be stable
            if (info.isStable && !excludeList.includes(entryNodePeerId)) {
              // find intermediate nodes with working PING
              for (const [intermediatePeerId, ping] of Object.entries(
                outgoingChannels
              )) {
                if (ping > 0) intermediatePeerIds.push(intermediatePeerId);
              }

              // find exit nodes which have working PING with one of the intermediate nodes
              for (const [exitNodePeerId, outgoingChannels] of Object.entries(
                exitNodesToOutgoingChannels
              )) {
                for (const [intermediatePeerId, ping] of Object.entries(
                  outgoingChannels
                )) {
                  if (
                    intermediatePeerIds.includes(intermediatePeerId) &&
                    ping > 0 &&
                    !exitNodePeerIds.includes(exitNodePeerId)
                  ) {
                    exitNodePeerIds.push(exitNodePeerId);
                  }
                }
              }

              // update result if we have found working routes
              if (exitNodePeerIds.length > 0) {
                result.push({ entryNodePeerId, exitNodePeerIds });
              }
            }

            return result;
          },
          []
        );

        // get a random selection of routes
        const selectedRoutes = routes
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.max(routes.length, amount));

        // get all PeerIds we need to pull from the DB
        const allPeerIdsSet = selectedRoutes.reduce<Set<string>>(
          (result, { entryNodePeerId, exitNodePeerIds }) => {
            result.add(entryNodePeerId);
            for (const exitNodePeerId of exitNodePeerIds)
              result.add(exitNodePeerId);
            return result;
          },
          new Set()
        );

        // get node data for all peerids
        const allPeerIdsData = await getRegisteredNodes(ops.db, {
          includeList: Array.from(allPeerIdsSet.values()),
        });

        // TODO: handle funding

        // create negative quota (showing that the client has used up initial quota)
        await createQuota(ops.db, {
          clientId: dbClient.id,
          quota: ops.baseQuota * BigInt(amount) * BigInt(-1),
          actionTaker: "discovery platform",
          paidBy: paidById,
        });

        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();

        return res.json({
          selectedRoutes: routes,
          nodes: allPeerIdsData,
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
