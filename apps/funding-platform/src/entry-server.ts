import { AccessTokenService } from "./access-token";
import express, { NextFunction, Request, Response } from "express";
import { DBInstance } from "./index";

const app = express();
const port = 3000;

const tokenIsValid =
  (accessTokenService: AccessTokenService) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const requestToken = req.headers["x-access-token"];
    if (!requestToken) return res.status(400).json("Missing Access Token");
    console.log(requestToken);
    const dbToken = await accessTokenService.getAccessToken(
      requestToken as string
    );
    if (!dbToken) return res.status(404).json("Access Token does not exist");

    if ((new Date(dbToken?.ExpiredAt).valueOf() ?? 0) < new Date().valueOf())
      return res.status(401).json("Access Token does not exist");

    // TODO: ADD HOPR CHECK
    next();
  };

export const startServer = (ops: {
  db: DBInstance;
  accessTokenService: AccessTokenService;
}) => {
  app.get("/api/access-token", async (req, res) => {
    const accessToken = await ops.accessTokenService.saveAccessToken();
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

  app.listen(port, () => {
    console.log(`Entry server is listening on port ${port}`);
  });
};
