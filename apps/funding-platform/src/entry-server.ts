import express from "express";
import AccessToken from "./access-token";

const app = express();
const port = process.env.PORT || 3000;

export const startServer = (ops: { secretKey: string }) => {
  app.get("/api/access-token", (req, res) => {
    const date = new Date();
    const maxHopr = 40;
    const token = new AccessToken(date, maxHopr, ops.secretKey);
    return res.json({
      access_token: token.toString(),
    });
  });
  app.post("/api/request/funds/:blockchain_address", (req, res) => {});
  app.get("/api/request/status", () => {});
  app.get("/api/request/status/:request-id", () => {});
  app.get("/api/funds", () => {});
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
};
