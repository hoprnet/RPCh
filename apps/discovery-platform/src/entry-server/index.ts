import { Pool } from "pg";
import express from "express";
import { DBInstance } from "../db";
import { v1Router } from "./routers/v1";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import compression from "compression";
import type { AvailabilityMonitorResult } from "../types";
import type { Secrets } from "./secrets";

const app = express();

export const entryServer = (ops: {
  db: DBInstance;
  dbPool: Pool;
  baseQuota: bigint;
  metricManager: MetricManager;
  secrets: Secrets;
  getAvailabilityMonitorResults: () => Map<string, AvailabilityMonitorResult>;
}) => {
  app.use(compression());

  app.use("/api/v1", v1Router(ops));

  // Prometheus metrics
  app.get("/api/metrics", async (req, res) => {
    const metrics = await ops.metricManager.getMetrics();
    return res.send(metrics);
  });

  return app;
};
