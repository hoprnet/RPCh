import express, { NextFunction, Request, Response } from "express";
import { AccessTokenService } from "../access-token";
import { chainIds, getBalanceForAllChains, getProviders } from "../blockchain";
import { CreateRequest, RequestService } from "../request";
import { isExpired } from "../utils";

const app = express();

const tokenIsValid =
  (
    accessTokenService: AccessTokenService,
    requestService: RequestService,
    maxAmountOfTokens: number,
    requestFunds?: boolean
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const accessTokenHash = req.headers["x-access-token"] as string;
    if (!accessTokenHash) return res.status(400).json("Missing Access Token");
    const dbToken = await accessTokenService.getAccessToken(accessTokenHash);
    if (!dbToken) return res.status(404).json("Access Token does not exist");

    if (isExpired(dbToken.ExpiredAt)) {
      return res.status(401).json("Access Token expired");
    }

    const tokenHasBalanceRes = await tokenHasBalance({
      requestService,
      maxAmountOfTokens,
      token: dbToken.Token,
      requestAmount: requestFunds ? Number(req.body.amount) : 0,
    });

    if (!tokenHasBalanceRes) {
      return res.status(401).json("Exceeded max amount of tokens redeemed");
    }

    next();
  };

export const tokenHasBalance = async (params: {
  requestService: RequestService;
  token: string;
  maxAmountOfTokens: number;
  requestAmount?: number;
}) => {
  const requestsByAccessToken =
    await params.requestService.getRequestsByAccessToken(params.token);
  const totalRequests = requestsByAccessToken?.filter(
    (req) =>
      req.status !== "FAILED" &&
      req.status !== "FAILED-DURING-PROCESSING" &&
      req.status !== "REJECTED-DURING-PROCESSING"
  );
  const sumOfTokensTotalPossibleRequests =
    totalRequests?.reduce((prev, next) => prev + Number(next.amount), 0) ?? 0;

  const tokenBalanceWithRequestAmount =
    sumOfTokensTotalPossibleRequests + (params.requestAmount ?? 0);
  if (params.maxAmountOfTokens < tokenBalanceWithRequestAmount) {
    return false;
  }
  return true;
};

export const entryServer = (ops: {
  accessTokenService: AccessTokenService;
  requestService: RequestService;
  walletAddress: string;
  maxAmountOfTokens: number;
  timeout: number;
}) => {
  app.use(express.json());

  app.get("/api/access-token", async (req, res) => {
    const accessToken = await ops.accessTokenService.createAccessToken({
      amount: ops.maxAmountOfTokens,
      timeout: ops.maxAmountOfTokens,
    });
    return res.json({
      accessToken: accessToken.Token,
      expiredAt: accessToken.ExpiredAt,
    });
  });

  app.post(
    "/api/request/funds/:blockchainAddress",
    tokenIsValid(
      ops.accessTokenService,
      ops.requestService,
      ops.maxAmountOfTokens,
      true
    ),
    async (req, res) => {
      const address = String(req.params.blockchainAddress);
      const amount = String(req.body.amount);
      const chainId = Number(req.body.chainId);
      const accessTokenHash = req.headers["x-access-token"] as string;
      const request = (await ops.requestService.createRequest({
        address,
        amount,
        accessTokenHash,
        chainId,
      })) as CreateRequest;
      return res.json({
        id: request.requestId,
      });
    }
  );

  app.get(
    "/api/request/status",
    tokenIsValid(
      ops.accessTokenService,
      ops.requestService,
      ops.maxAmountOfTokens
    ),
    async (req, res) => {
      const requests = await ops.requestService.getRequests();
      return res.status(200).json(requests);
    }
  );

  app.get(
    "/api/request/status/:requestId",
    tokenIsValid(
      ops.accessTokenService,
      ops.requestService,
      ops.maxAmountOfTokens
    ),
    async (req, res) => {
      const requestId = Number(req.params.requestId);
      const request = await ops.requestService.getRequest(requestId);
      return res.status(200).json(request);
    }
  );

  app.get(
    "/api/funds",
    tokenIsValid(
      ops.accessTokenService,
      ops.requestService,
      ops.maxAmountOfTokens
    ),
    async () => {
      const providers = await getProviders(Array.from(chainIds.keys()));
      const balances = await getBalanceForAllChains(
        ops.walletAddress,
        providers
      );
      const compromisedRequests =
        await ops.requestService.getAllCompromisedRequests();
      const frozenBalances = await ops.requestService.sumAmountOfRequests(
        compromisedRequests ?? []
      );

      const availableBalances = ops.requestService.calculateAvailableFunds(
        balances,
        frozenBalances
      );
      return {
        available: availableBalances,
        frozen: frozenBalances,
      };
    }
  );

  return app;
};
