import { AccessTokenService } from "../access-token";
import express, { NextFunction, Request, Response } from "express";

const app = express();

const THIRTY_MINUTES = 30;
const MAX_HOPR = 40;

export const tokenIsValid =
  (accessTokenService: AccessTokenService) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const requestToken = req.headers["x-access-token"];
    if (!requestToken) return res.status(400).json("Missing Access Token");
    const dbToken = await accessTokenService.getAccessToken(
      requestToken as string
    );
    if (!dbToken) return res.status(404).json("Access Token does not exist");

    if (
      (new Date(dbToken?.ExpiredAt).valueOf() ?? 0) <
      new Date(Date.now()).valueOf()
    )
      return res.status(401).json("Access Token expired");

    // TODO: ADD HOPR CHECK
    next();
  };

export const entryServer = (ops: {
  accessTokenService: AccessTokenService;
}) => {
  app.get("/api/access-token", async (req, res) => {
    const accessToken = await ops.accessTokenService.createAccessToken({
      amount: MAX_HOPR,
      timeout: THIRTY_MINUTES,
    });
    return res.json({
      accessToken: accessToken.getHash(),
      expiredAt: accessToken.getExpiredAt(),
    });
  });

  app.post(
    "/api/request/funds/:blockchain_address",
    tokenIsValid(ops.accessTokenService),
    (req, res) => {
      return res.json({
        data: "requested",
      });
    }
  );

  app.get(
    "/api/request/status",
    tokenIsValid(ops.accessTokenService),
    (req, res) => {
      return res.status(200).json();
    }
  );

  app.get(
    "/api/request/status/:request-id",
    tokenIsValid(ops.accessTokenService),
    () => {}
  );

  app.get("/api/funds", tokenIsValid(ops.accessTokenService), () => {});

  return app;
};
