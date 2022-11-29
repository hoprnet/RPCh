import express, { NextFunction, Request, Response } from "express";
import AccessToken from "./access-token";
import DBAdapter from "./db";
import SQL from "sql-template-strings";
import { CreateAccessToken, QueryAccessToken } from "./types";
import { utils } from "rpch-common";

const app = express();
const port = process.env.PORT || 3000;
const THIRTY_MINUTES = 30;
const MAX_HOPR = 40;
const { isExpired } = utils;

const tokenIsValid = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const db = DBAdapter.getInstance();
  console.log(req.headers);
  const requestToken = req.headers["x-funding-access-token"];
  if (!requestToken) throw new Error("Missing Access Token");

  const dbTokens = (await db.query(
    SQL`SELECT * FROM AccessToken WHERE Token=${requestToken}`
  )) as QueryAccessToken[];
  if (!dbTokens.length) throw new Error("Access Token does not exist");

  const token = dbTokens.at(0);
  if ((token?.ExpiredAt.valueOf() ?? 0) < new Date().valueOf())
    throw new Error("Access Token has expired");

  // TODO: ADD HOPR CHECK
  next();
};

export const startServer = () => {
  app.get("/api/access-token", async (req, res) => {
    const db = DBAdapter.getInstance();
    const now = new Date();
    const expiredAt = new Date(
      new Date(now).setMinutes(now.getMinutes() + THIRTY_MINUTES)
    );
    const token = new AccessToken(
      expiredAt,
      MAX_HOPR,
      process.env.SECRET_KEY ?? ""
    );
    const query: CreateAccessToken = {
      Token: token.toString(),
      ExpiredAt: expiredAt.toISOString().slice(0, 19).replace("T", " "),
      CreatedAt: token
        .getCreatedAt()
        .toISOString()
        .slice(0, 19)
        .replace("T", " "),
    };

    const resDb = await db.query(
      SQL`INSERT INTO AccessToken(Token, ExpiredAt, CreatedAt) values (${query.Token}, ${query.ExpiredAt}, ${query.CreatedAt})`
    );

    return res.json({
      access_token: token.toString(),
    });
  });

  app.post(
    "/api/request/funds/:blockchain_address",
    tokenIsValid,
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
