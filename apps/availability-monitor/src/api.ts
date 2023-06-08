import type Reviewer from "./reviewer";
import express from "express";
import compression from "compression";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import { createLogger, metricMiddleware } from "./utils";

const log = createLogger(["api"]);
const app = express();

export default function api(ops: {
  metricManager: MetricManager;
  reviewer: Reviewer;
}) {
  const requestDurationHistogram = ops.metricManager.createHistogram(
    "request_duration_seconds",
    "duration of requests in seconds",
    {
      buckets: [0.1, 0.5, 1, 5, 10, 30],
      labelNames: ["method", "path", "status"],
    }
  );

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

  // prometheus metrics
  app.get("/api/metrics", async (_req, res) => {
    const metrics = await ops.metricManager.getMetrics();
    return res.send(metrics);
  });

  // latest node info
  app.get(
    "/api/nodes",
    metricMiddleware(requestDurationHistogram),
    async (_req, res) => {
      return res.send(Array.from(ops.reviewer.results.entries()));
    }
  );

  return app;
}
