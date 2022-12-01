import { AccessTokenService } from "../access-token";
import express, { NextFunction, Request, Response } from "express";
import { DBInstance } from "../index";

const app = express();

const tokenIsValid =
  (accessTokenService: AccessTokenService) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const requestToken = req.headers["x-access-token"];
    if (!requestToken) return res.status(400).json("Missing Access Token");
    const dbToken = await accessTokenService.getAccessToken(
      requestToken as string
    );
    if (!dbToken) return res.status(404).json("Access Token does not exist");

    if ((new Date(dbToken?.ExpiredAt).valueOf() ?? 0) < new Date().valueOf())
      return res.status(401).json("Access Token does not exist");

    // TODO: ADD HOPR CHECK
    next();
  };

export const entryServer = (ops: {
  db: DBInstance;
  accessTokenService: AccessTokenService;
}) => {
  app.get("/api/access-token", async (req, res) => {
    const accessToken = await ops.accessTokenService.createAccessToken();
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

  app.get("/api/request/status", () => {});

  app.get("/api/request/status/:request-id", () => {});

  app.get("/api/funds", () => {});

  return app;
};
