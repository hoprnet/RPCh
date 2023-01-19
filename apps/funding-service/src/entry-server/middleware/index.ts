import { NextFunction, Request, Response } from "express";
import { AccessTokenService } from "../../access-token";
import { RequestService } from "../../request";
import { isExpired, createLogger } from "../../utils";

const log = createLogger(["entry-server", "middleware"]);

/**
 * Middleware used to check if token has expired or has been used with too many requests
 * @param accessTokenService
 * @param requestService
 * @param maxAmountOfTokens
 * @param requestFunds
 */
export const tokenIsValid =
  (
    accessTokenService: AccessTokenService,
    requestService: RequestService,
    maxAmountOfTokens: number,
    requestFunds?: boolean
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const accessTokenHash: string | undefined =
      req.headers["x-access-token"]?.toString();
    log.verbose("validating token", accessTokenHash);
    if (!accessTokenHash) return res.status(400).json("Missing Access Token");
    const dbToken = await accessTokenService.getAccessToken(accessTokenHash);
    if (!dbToken) return res.status(404).json("Access Token does not exist");

    if (isExpired(dbToken.expired_at)) {
      log.verbose("token has expired", accessTokenHash);
      return res.status(401).json("Access Token expired");
    }

    const hasEnough = await doesAccessTokenHaveEnoughBalance({
      requestService,
      maxAmountOfTokens,
      token: dbToken.token,
      requestAmount: requestFunds ? Number(req.body.amount) : 0,
    });

    if (!hasEnough) {
      log.verbose(
        "exceeded max amount of tokens redeemed per access token",
        accessTokenHash
      );
      return res.status(401).json("Exceeded max amount of tokens redeemed");
    }

    next();
  };

/**
 * Checks if token can make another request without exceeding max amount of tokens
 * @returns boolean
 */
export const doesAccessTokenHaveEnoughBalance = async (params: {
  requestService: RequestService;
  token: string;
  maxAmountOfTokens: number;
  requestAmount?: number;
}): Promise<Boolean> => {
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
