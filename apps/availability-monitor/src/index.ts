import type { DBInstance } from "./db";
import pgp from "pg-promise";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as Prometheus from "prom-client";
import * as constants from "./constants";
import API from "./api";
import Reviewer from "./reviewer";
import { createLogger } from "./utils";

const log = createLogger();

async function start(ops: {
  db: DBInstance;
  port: number;
  metricPrefix: string;
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

  const app = API({
    db: ops.db,
    metricManager: metricManager,
  });

  // start listening at PORT for requests
  const server = app.listen(ops.port, "0.0.0.0", () => {
    log.normal("API server is up on port %i", ops.port);
  });

  // set server timeout to 30s
  server.setTimeout(30e3);

  const reviewer = new Reviewer(ops.db, 30e3, 5);
  reviewer.start();

  return () => {
    reviewer.stop();
  };
}

function main() {
  if (!constants.DB_CONNECTION_URL) {
    throw new Error('Missing "DB_CONNECTION_URL" env variable');
  }

  // init db
  const pgInstance = pgp();
  const connectionString: string = constants.DB_CONNECTION_URL!;
  // create table if the table does not exist
  const dbInstance = pgInstance({
    connectionString,
  });

  start({
    port: constants.PORT,
    db: dbInstance,
    metricPrefix: constants.METRIC_PREFIX,
  });
}

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  main();
}
