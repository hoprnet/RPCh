import express from "express";
import { DBInstance } from "../db";
import { v1Router } from "./routers/v1";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import compression from "compression";
import type { AvailabilityMonitorResult } from "../types";

const app = express();

export const entryServer = (ops: {
  db: DBInstance;
  baseQuota: bigint;
  metricManager: MetricManager;
  secret: string;
  getAvailabilityMonitorResults: () => Map<string, AvailabilityMonitorResult>;
}) => {
  app.use(compression());

  app.use(
    "/api/v1",
    v1Router({
      baseQuota: ops.baseQuota,
      db: ops.db,
      metricManager: ops.metricManager,
      secret: ops.secret,
      getAvailabilityMonitorResults: ops.getAvailabilityMonitorResults,
    })
  );

  // Prometheus metrics
  app.get("/api/metrics", async (req, res) => {
    const metrics = await ops.metricManager.getMetrics();
    return res.send(metrics);
  });

  return app;
};
