import { Pool } from "pg";
import express from "express";
import { v1Router } from "./routers/v1";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import compression from "compression";

const app = express();

export const entryServer = (ops: {
  dbPool: Pool;
  metricManager: MetricManager;
  // @ts-ignore
  secrets: Secrets;
  url: string;
}) => {
  app.use(compression());

  // app.set("trust proxy", 1);
  app.use("/api/v1", v1Router(ops));

  // Prometheus metrics
  app.get("/api/metrics", async (req, res) => {
    const metrics = await ops.metricManager.getMetrics();
    return res.send(metrics);
  });

  return app;
};
