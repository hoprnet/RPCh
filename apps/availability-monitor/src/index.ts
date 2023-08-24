import { Client } from "pg";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as Prometheus from "prom-client";
import * as constants from "./constants";
import API from "./api";
import Reviewer from "./reviewer";
import { createLogger } from "./utils";

const log = createLogger();

async function start(ops: {
  db: Client;
  port: number;
  metricPrefix: string;
  reviewerIntervalMs: number;
  reviewerConcurrency: number;
}) {
  // create prometheus registry
  const register = new Prometheus.Registry();

  // add default metrics to registry
  Prometheus.collectDefaultMetrics({ register });

  const metricManager = new MetricManager(
    Prometheus,
    register,
    ops.metricPrefix
  );

  // initializes reviewer
  const reviewer = new Reviewer(
    ops.db,
    metricManager,
    ops.reviewerIntervalMs,
    ops.reviewerConcurrency
  );
  reviewer.start();

  // start restful server
  const app = API({
    metricManager,
    reviewer,
  });

  // start listening at PORT for requests
  const server = app.listen(ops.port, "0.0.0.0", () => {
    log.normal("API server is up on port %i", ops.port);
  });

  // set server timeout to 30s
  server.setTimeout(30e3);

  return () => {
    reviewer.stop();
  };
}

function main() {
  if (!process.env.DB_CONNECTION_URL) {
    throw new Error("Missing 'DB_CONNECTION_URL' env var.");
  }

  // init db
  const connectionString: string = constants.DB_CONNECTION_URL!;
  // create table if the table does not exist
  const pgC = new Client({ connectionString });

  start({
    port: constants.PORT,
    db: pgC,
    metricPrefix: constants.METRIC_PREFIX,
    reviewerIntervalMs: constants.REVIEWER_INTERVAL_MS,
    reviewerConcurrency: constants.REVIEWER_CONCURRENCY,
  });
}

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  main();
}
