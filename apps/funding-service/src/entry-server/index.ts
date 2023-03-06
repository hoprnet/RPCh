import express from "express";
import { AccessTokenService } from "../access-token";
import { getBalanceForAllChains, getProviders } from "../blockchain";
import { RequestService } from "../request";
import { createLogger } from "../utils";
import {
  metricMiddleware,
  tokenCanRequestFunds,
  tokenIsActive,
  validateFundingRequestBody,
} from "./middleware";
import { validationResult, param } from "express-validator";
import * as constants from "../constants";
import { utils } from "@rpch/common";
import { Registry } from "prom-client";
import { createCounter, createHistogram } from "../metric";

const app = express();
const log = createLogger(["entry-server"]);

/**
 * Express server that holds all routes
 * @param accessTokenService
 * @param requestService
 * @param walletAddress address used to query balance
 * @param maxAmountOfTokens max limit of tokens that an access token can request
 * @param timeout amount of milliseconds that a token will be valid
 * @param register Prometheus register that will hold metrics
 * @returns Express app
 */
export const entryServer = (ops: {
  accessTokenService: AccessTokenService;
  requestService: RequestService;
  walletAddress: string;
  maxAmountOfTokens: bigint;
  timeout: number;
  register: Registry;
}) => {
  // Metrics
  const counterSuccessfulRequests = createCounter(
    ops.register,
    "counter_successful_request",
    "amount of successful requests discovery platform has processed",
    { labelNames: ["method", "path", "status"] as const }
  );

  const counterFailedRequests = createCounter(
    ops.register,
    "counter_failed_request",
    "amount of failed requests discovery platform has processed",
    { labelNames: ["method", "path", "status"] as const }
  );

  const requestDurationHistogram = createHistogram(
    ops.register,
    "request_duration_seconds",
    "duration of requests in seconds",
    {
      buckets: [0.1, 0.5, 1, 5, 10, 30],
      labelNames: ["method", "path", "status"] as const,
    }
  );

  app.use(express.json());

  // Prometheus metrics
  app.get("/api/metrics", async (req, res) => {
    const metrics = await ops.register.metrics();
    return res.send(metrics);
  });

  // log entry calls
  app.use((req, _res, next) => {
    const { method, path, params, body } = req;
    log.verbose(`${method.toUpperCase()} ${path}`, {
      params,
      body,
    });
    next();
  });

  app.set("json replacer", utils.bigIntReplacer);

  app.get(
    "/api/access-token",
    metricMiddleware(requestDurationHistogram),
    async (req, res) => {
      try {
        const accessToken = await ops.accessTokenService.createAccessToken({
          amount: ops.maxAmountOfTokens,
          timeout: ops.timeout,
        });
        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();
        return res.json({
          accessToken: accessToken?.token,
          expiredAt: accessToken?.expired_at,
          createdAt: accessToken?.created_at,
          amountLeft: ops.maxAmountOfTokens.toString(),
        });
      } catch (e) {
        log.error("Can not create access token", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  app.post(
    "/api/request/funds/:blockchainAddress",
    metricMiddleware(requestDurationHistogram),
    validateFundingRequestBody(),
    tokenIsActive(ops.accessTokenService),
    tokenCanRequestFunds(
      ops.accessTokenService,
      ops.requestService,
      ops.maxAmountOfTokens
    ),
    async (req: express.Request, res: express.Response) => {
      try {
        // check if validation failed
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const nodeAddress = String(req.params.blockchainAddress);
        const amount = BigInt(req.body.amount);
        const chainId = Number(req.body.chainId);

        // can be enforced because the existence is checked in the middleware
        const accessTokenHash: string | undefined =
          req.headers["x-access-token"]!.toString();

        const request = await ops.requestService.createRequest({
          nodeAddress,
          amount,
          accessTokenHash,
          chainId,
        });
        const amountUsed = await ops.requestService.getSumOfRequestsByStatus(
          [...constants.UNRESOLVED_REQUESTS_STATUSES, "SUCCESS"],
          accessTokenHash
        );

        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();

        return res.json({
          id: request.id,
          amountLeft: String(ops.maxAmountOfTokens - amountUsed),
        });
      } catch (e) {
        log.error("Can not request funding", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  app.get(
    "/api/request/status",
    metricMiddleware(requestDurationHistogram),
    tokenIsActive(ops.accessTokenService),
    async (req, res) => {
      try {
        const requests = await ops.requestService.getRequests();
        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();
        return res.status(200).json(requests);
      } catch (e) {
        log.error("Can not get status for requests", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  app.get(
    "/api/request/status/:requestId",
    metricMiddleware(requestDurationHistogram),
    param("requestId").isNumeric(),
    tokenIsActive(ops.accessTokenService),
    async (req, res) => {
      try {
        // check if validation failed
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const requestId = Number(req.params.requestId);
        const request = await ops.requestService.getRequest(requestId);
        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();
        return res.status(200).json(request);
      } catch (e) {
        log.error("Can not get status for a single request", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  app.get(
    "/api/funds",
    metricMiddleware(requestDurationHistogram),
    tokenIsActive(ops.accessTokenService),
    async (req, res) => {
      try {
        log.verbose([
          "getting funds for chains",
          [...Object.keys(constants.CONNECTION_INFO)],
        ]);
        const providers = await getProviders(
          [...Object.keys(constants.CONNECTION_INFO)].map(Number)
        );
        const balances = await getBalanceForAllChains(
          constants.SMART_CONTRACTS_PER_CHAIN,
          ops.walletAddress,
          providers
        );

        const frozenBalance = await ops.requestService.getSumOfRequestsByStatus(
          [...constants.UNRESOLVED_REQUESTS_STATUSES]
        );

        // DISCLAIMER: hardcoded to only accept one chain at a time
        const availableBalance = balances[0] - frozenBalance;

        // all balances are in wei
        const jsonString = JSON.stringify(
          { availableBalance, frozenBalance },
          utils.bigIntReplacer
        );
        counterSuccessfulRequests
          .labels({ method: req.method, path: req.path, status: 200 })
          .inc();
        return res.json(JSON.parse(jsonString));
      } catch (e) {
        log.error("Can not get status for a single request", e);
        counterFailedRequests
          .labels({ method: req.method, path: req.path, status: 500 })
          .inc();
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  // Prometheus metrics
  app.get("/api/metrics", async (req, res) => {
    const metrics = await ops.register.metrics();
    return res.json(metrics);
  });

  return app;
};
