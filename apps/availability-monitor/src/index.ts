import pgp from "pg-promise";
import { Pool } from "pg";
// import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as Prometheus from "prom-client";
import * as constants from "./constants";
// import API from "./api";
// import Reviewer from "./reviewer";
import * as availability from "./availability";
// import { createLogger } from "./utils";

// const log = createLogger();

async function start(ops: {
  dbPool: Pool;
  dbInst: pgp.IDatabase<{}>;
  port: number;
  metricPrefix: string;
  reviewerIntervalMs: number;
  reviewerConcurrency: number;
}) {
  // create prometheus registry
  const register = new Prometheus.Registry();

  // add default metrics to registry
  Prometheus.collectDefaultMetrics({ register });

  //  const metricManager = new MetricManager(
  //    Prometheus,
  //    register,
  //    ops.metricPrefix
  //  );

  // initializes reviewer
  // const reviewer = new Reviewer(
  //   ops.dbInst,
  //   metricManager,
  //   ops.reviewerIntervalMs,
  //   ops.reviewerConcurrency
  // );
  // reviewer.start();

  // start restful server
  // const app = API({
  // metricManager,
  // reviewer,
  // });

  // start listening at PORT for requests
  // const server = app.listen(ops.port, "0.0.0.0", () => {
  // log.normal("API server is up on port %i", ops.port);
  // });

  // set server timeout to 30s
  // server.setTimeout(30e3);

  availability.start(ops.dbPool);

  // return () => {
  // reviewer.stop();
  // };
}

function main() {
  // server port
  if (!process.env.PORT) {
    throw new Error("Missing 'PORT' env var.");
  }
  // postgres url
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing 'DATABASE_URL' env var.");
  }

  // init db
  const connectionString = process.env.DATABASE_URL;
  const dbPool = new Pool({ connectionString });
  const dbInst = pgp()({ connectionString });

  start({
    port: parseInt(process.env.PORT, 10),
    dbPool,
    dbInst,
    metricPrefix: constants.METRIC_PREFIX,
    reviewerIntervalMs: constants.REVIEWER_INTERVAL_MS,
    reviewerConcurrency: constants.REVIEWER_CONCURRENCY,
  });
}

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  main();
}
