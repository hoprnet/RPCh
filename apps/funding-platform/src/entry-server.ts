import { AccessTokenService } from "./access-token";
import { DBInterface } from "./db";
import express, { NextFunction, Request, Response } from "express";

const app = express();
const port = 3000;

const tokenIsValid =
  (db: DBInterface) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const requestToken = req.headers["x-access-token"];
    if (!requestToken) throw new Error("Missing Access Token");

    const dbTokens = db.getAccessToken(requestToken as string);
    if (!dbTokens) throw new Error("Access Token does not exist");

    const token = dbTokens;
    if ((token?.ExpiredAt.valueOf() ?? 0) < new Date().valueOf())
      throw new Error("Access Token has expired");

    // TODO: ADD HOPR CHECK
    next();
  };

export const startServer = (ops: {
  db: DBInterface;
  accessTokenService: AccessTokenService;
}) => {
  app.get("/api/access-token", async (req, res) => {
    const accessToken = await ops.accessTokenService.saveAccessToken();
    return res.json({
      accessToken: accessToken.toString(),
      expiredAt: accessToken.getExpiredAt(),
    });
  });

  app.post(
    "/api/request/funds/:blockchain_address",
    tokenIsValid(ops.db),
    (req, res) => {
      return res.json({
        data: "requested",
      });
    }
  );

  app.get("/api/request/status", () => {});

  app.get("/api/request/status/:request-id", () => {});

  app.get("/api/funds", () => {});

  app.listen(port, () => {
    console.log(`Entry server is listening on port ${port}`);
  });
};
