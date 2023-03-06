import express, { Request } from "express";
import { DBInstance } from "../db";
import { FundingServiceApi } from "../funding-service-api";
import { v1Router } from "./routers/v1";
import { Registry, register } from "prom-client";

const app = express();

export const entryServer = (ops: {
  db: DBInstance;
  baseQuota: bigint;
  fundingServiceApi: FundingServiceApi;
  register: Registry;
}) => {
  app.use(
    "/api/v1",
    v1Router({
      baseQuota: ops.baseQuota,
      db: ops.db,
      fundingServiceApi: ops.fundingServiceApi,
      register: register,
    })
  );

  // Prometheus metrics
  app.get("/api/metrics", async (req, res) => {
    const metrics = await register.metrics();
    return res.json(metrics);
  });

  return app;
};
