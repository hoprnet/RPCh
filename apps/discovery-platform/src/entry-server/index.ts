import express from "express";
import { DBInstance } from "../db";
import { FundingServiceApi } from "../funding-service-api";
import { v1Router } from "./routers/v1";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import compression from "compression";
const app = express();

export const entryServer = (ops: {
  db: DBInstance;
  baseQuota: bigint;
  fundingServiceApi: FundingServiceApi;
  metricManager: MetricManager;
  secret: string;
}) => {
  app.use(compression());

  app.use(
    "/api/v1",
    v1Router({
      baseQuota: ops.baseQuota,
      db: ops.db,
      fundingServiceApi: ops.fundingServiceApi,
      metricManager: ops.metricManager,
      secret: ops.secret,
    })
  );

  // Prometheus metrics
  app.get("/api/metrics", async (req, res) => {
    const metrics = await ops.metricManager.getMetrics();
    return res.send(metrics);
  });

  return app;
};
