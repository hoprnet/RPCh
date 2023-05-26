import type { DBInstance } from "./db";
import express from "express";
import compression from "compression";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import { createLogger } from "./utils";

const log = createLogger(["api"]);
const app = express();

export default function api(ops: {
  db: DBInstance;
  metricManager: MetricManager;
}) {
  app.use(compression());
  app.use(express.json());

  // log entry calls
  app.use((req, _res, next) => {
    const { method, path, params, body } = req;
    log.verbose(`${method.toUpperCase()} ${path}`, {
      params,
      body,
    });
    next();
  });

  // Prometheus metrics
  app.get("/api/metrics", async (_req, res) => {
    const metrics = await ops.metricManager.getMetrics();
    return res.send(metrics);
  });

  return app;
}
