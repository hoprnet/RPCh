import express from "express";
import { AccessTokenService } from "../access-token";
import { blockchain } from "@rpch/common";
import { RequestService } from "../request";
import { createLogger } from "../utils";
import {
  tokenCanRequestFunds,
  tokenIsActive,
  validateFundingRequestBody,
} from "./middleware";
import { validationResult, param } from "express-validator";
import * as constants from "../constants";
import { utils } from "@rpch/common";

const app = express();
const log = createLogger(["entry-server"]);

/**
 * Express server that holds all routes
 * @param accessTokenService
 * @param requestService
 * @param walletAddress address used to query balance
 * @param maxAmountOfTokens max limit of tokens that an access token can request
 * @param timeout amount of milliseconds that a token will be valid
 * @returns Express app
 */
export const entryServer = (ops: {
  accessTokenService: AccessTokenService;
  requestService: RequestService;
  walletAddress: string;
  maxAmountOfTokens: bigint;
  timeout: number;
}) => {
  app.use(express.json());
  app.set("json replacer", utils.bigIntReplacer);

  app.get("/api/access-token", async (req, res) => {
    try {
      log.verbose("GET /api/access-token");
      const accessToken = await ops.accessTokenService.createAccessToken({
        amount: ops.maxAmountOfTokens,
        timeout: ops.timeout,
      });
      return res.json({
        accessToken: accessToken?.token,
        expiredAt: accessToken?.expired_at,
        createdAt: accessToken?.created_at,
        amountLeft: ops.maxAmountOfTokens.toString(),
      });
    } catch (e) {
      log.error("Can not create access token", e);
      return res.status(500).json({ errors: "Unexpected error" });
    }
  });

  app.post(
    "/api/request/funds/:blockchainAddress",
    validateFundingRequestBody(),
    tokenIsActive(ops.accessTokenService),
    tokenCanRequestFunds(
      ops.accessTokenService,
      ops.requestService,
      ops.maxAmountOfTokens
    ),
    async (req: express.Request, res: express.Response) => {
      try {
        log.verbose(
          `POST /api/request/funds/:blockchainAddress`,
          req.params,
          req.body
        );

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
        return res.json({
          id: request.id,
          amountLeft: String(ops.maxAmountOfTokens - amountUsed),
        });
      } catch (e) {
        log.error("Can not request funding", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  app.get(
    "/api/request/status",
    tokenIsActive(ops.accessTokenService),
    async (req, res) => {
      try {
        log.verbose(`GET /api/request/status`);
        const requests = await ops.requestService.getRequests();

        return res.status(200).json(requests);
      } catch (e) {
        log.error("Can not get status for requests", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  app.get(
    "/api/request/status/:requestId",
    param("requestId").isNumeric(),
    tokenIsActive(ops.accessTokenService),
    async (req, res) => {
      try {
        log.verbose(`GET /api/request/status/:requestId`, req.params);
        // check if validation failed
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const requestId = Number(req.params.requestId);
        const request = await ops.requestService.getRequest(requestId);
        return res.status(200).json(request);
      } catch (e) {
        log.error("Can not get status for a single request", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  app.get(
    "/api/funds",
    tokenIsActive(ops.accessTokenService),
    async (req, res) => {
      try {
        log.verbose(`GET /api/funds`);
        log.verbose([
          "getting funds for chains",
          [...Object.keys(constants.CONNECTION_INFO)],
        ]);
        const providers = await blockchain.getProviders(
          [...Object.keys(constants.CONNECTION_INFO)].map(Number)
        );
        const balances = await blockchain.getBalanceForAllChains(
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
        return res.json(JSON.parse(jsonString));
      } catch (e) {
        log.error("Can not get status for a single request", e);
        return res.status(500).json({ errors: "Unexpected error" });
      }
    }
  );

  return app;
};
