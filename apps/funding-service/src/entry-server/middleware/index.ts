import { NextFunction, Request, Response } from "express";
import { AccessTokenService } from "../../access-token";
import { RequestService } from "../../request";
import { isExpired, createLogger } from "../../utils";
import { validationResult, body } from "express-validator";
import { errors } from "pg-promise";
import * as constants from "../../constants";

const log = createLogger(["entry-server", "middleware"]);

/**
 * Middleware used to check if token has expired
 * @param accessTokenService
 * @param requestService
 * @param maxAmountOfTokens
 * @param requestFunds
 */
export const tokenIsActive =
  (accessTokenService: AccessTokenService) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const accessTokenHash: string | undefined =
      req.headers["x-access-token"]?.toString();
    log.verbose("validating token", accessTokenHash);
    if (!accessTokenHash)
      return res.status(400).json({ errors: "Missing Access Token" });

    try {
      const dbToken = await accessTokenService.getAccessToken(accessTokenHash);

      if (isExpired(dbToken.expired_at)) {
        log.verbose("token has expired", accessTokenHash);
        return res.status(401).json({ errors: "Access Token expired" });
      }

      next();
    } catch (e) {
      if (e instanceof errors.QueryResultError) {
        return res.status(404).json({ errors: "Access Token does not exist" });
      } else {
        log.error("failed to validate token", req);
      }
    }
  };

export const tokenCanRequestFunds =
  (
    accessTokenService: AccessTokenService,
    requestService: RequestService,
    maxAmountOfTokens: bigint
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const accessTokenHash: string | undefined =
      req.headers["x-access-token"]?.toString();

    log.verbose("validating if token can request funds", accessTokenHash);

    if (!accessTokenHash)
      return res.status(400).json({ errors: "Missing Access Token" });

    if (!req.body.amount) {
      return res.status(400).json({ errors: "Missing amount to fund" });
    }

    const dbToken = await accessTokenService.getAccessToken(accessTokenHash);

    const sumOfRequestsByAccessToken =
      await requestService.getSumOfRequestsByStatus(
        [...constants.UNRESOLVED_REQUESTS_STATUSES, "SUCCESS"],
        accessTokenHash
      );

    const hasEnough = await doesAccessTokenHaveEnoughBalance(
      sumOfRequestsByAccessToken,
      maxAmountOfTokens,
      BigInt(req.body.amount)
    );

    if (!hasEnough) {
      log.verbose(
        "exceeded max amount of tokens redeemed per access token",
        accessTokenHash
      );
      return res
        .status(401)
        .json({ errors: "Exceeded max amount of tokens redeemed" });
    }

    next();
  };

/**
 * Checks if token can make another request without exceeding max amount of tokens
 * @returns boolean
 */
export const doesAccessTokenHaveEnoughBalance = async (
  sumOfRequests: bigint,
  maxAmountOfTokens: bigint,
  requestAmount: bigint
): Promise<Boolean> => {
  const tokenBalanceWithRequestAmount = sumOfRequests + requestAmount;

  if (maxAmountOfTokens < tokenBalanceWithRequestAmount) {
    return false;
  }

  return true;
};

export const validateFundingRequestBody = () => [
  body("amount")
    .exists()
    .notEmpty()
    .withMessage("Amount is required")
    .bail()
    .isNumeric({ no_symbols: true })
    .withMessage("Amount must be a number"),
  body("chainId")
    .notEmpty()
    .withMessage("Chain ID is required")
    .bail()
    .isNumeric(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      next();
    } catch (err) {
      log.error("could not validate amount, chainId or token");
      return res.status(500).json({ errors: "Unexpected error" });
    }
  },
];
