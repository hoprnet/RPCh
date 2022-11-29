import express from "express";
import AccessToken from "./access-token";
import DBAdapter from "./db";
import SQL from "sql-template-strings";
import { CreateAccessToken } from "./types";
const app = express();
const port = process.env.PORT || 3000;
const THIRTY_MINUTES = 30;
const MAX_HOPR = 40;

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

  app.post("/api/request/funds/:blockchain_address", (req, res) => {});

  app.get("/api/request/status", () => {});

  app.get("/api/request/status/:request-id", () => {});

  app.get("/api/funds", () => {});

  app.listen(port, () => {
    console.log(`Entry server is listening on port ${port}`);
  });
};
