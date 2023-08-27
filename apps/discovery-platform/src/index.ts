import { Pool } from "pg";
import { DBInstance, updateRegisteredNode } from "./db";
import { entryServer } from "./entry-server";
import { createLogger } from "./utils";
import pgp from "pg-promise";
import { checkCommitmentForFreshNodes } from "./registered-node";
import { checkCommitment, getChannelsFromGraph } from "./graph-api";
import * as constants from "./constants";
import * as Prometheus from "prom-client";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import { runMigrations } from "@rpch/common/build/internal/db";
import * as async from "async";
import path from "path";
import migrate from "node-pg-migrate";
import type { RegisteredNodeDB, AvailabilityMonitorResult } from "./types";

const log = createLogger();

const start = async (ops: {
  db: DBInstance;
  dbPool: Pool;
  baseQuota: bigint;
  fundingServiceUrl: string;
  secret: string;
  availabilityMonitorUrl?: string;
}) => {
  let availabilityMonitorResults = new Map<string, AvailabilityMonitorResult>();

  // run db migrations
  const migrationsDirectory = path.join(__dirname, "../migrations");
  await runMigrations(
    constants.DB_CONNECTION_URL!,
    migrationsDirectory,
    migrate
  );

  // create prometheus registry
  const register = new Prometheus.Registry();

  // add default metrics to registry
  Prometheus.collectDefaultMetrics({ register });

  const metricManager = new MetricManager(
    Prometheus,
    register,
    constants.METRIC_PREFIX
  );

  const app = entryServer({
    db: ops.db,
    dbPool: ops.dbPool,
    baseQuota: ops.baseQuota,
    metricManager: metricManager,
    secret: ops.secret,
    getAvailabilityMonitorResults: () => availabilityMonitorResults,
  });

  // start listening at PORT for requests
  const server = app.listen(constants.PORT, "0.0.0.0", () => {
    log.normal("entry server is up");
  });

  // set server timeout to 30s
  server.setTimeout(30e3);

  // Create a task queue with a concurrency limit of QUEUE_CONCURRENCY_LIMIT
  // to process nodes in parallel for commitment check
  const queueCheckCommitment = async.queue(
    async (task: RegisteredNodeDB, callback) => {
      try {
        const channels = await getChannelsFromGraph(task.id);
        const nodeIsCommitted = await checkCommitment({
          channels,
          node: task,
          minBalance: constants.BALANCE_THRESHOLD,
          minChannels: constants.CHANNELS_THRESHOLD,
        });

        if (nodeIsCommitted) {
          await updateRegisteredNode(ops.db, {
            ...task,
            status: "READY",
          });
        }

        callback();
      } catch (e) {}
    },
    constants.QUEUE_CONCURRENCY_LIMIT
  );

  // adds fresh node to queue
  const checkCommitmentInterval = setInterval(
    () =>
      checkCommitmentForFreshNodes(
        ops.db,
        queueCheckCommitment,
        (node, err) => {
          if (err) {
            log.error("Failed to process node", node, err);
          }
        }
      ),
    60e3
  );

  // fetch and cache availability monitor results
  const updateAvailabilityMonitorResultsInterval = setInterval(async () => {
    try {
      if (!ops.availabilityMonitorUrl) return;
      const response = await fetch(
        `${ops.availabilityMonitorUrl}/api/nodes`
      ).then(
        (res) => res.json() as unknown as [string, AvailabilityMonitorResult][]
      );
      availabilityMonitorResults = new Map(response);
      log.verbose(
        "Updated availability monitor results with size %i",
        availabilityMonitorResults.size
      );
    } catch (error) {
      log.error("Error fetching availability monitor results", error);
    }
  }, 1000);

  return () => {
    clearInterval(checkCommitmentInterval);
    clearInterval(updateAvailabilityMonitorResultsInterval);
  };
};

const main = () => {
  if (!process.env.DB_CONNECTION_URL) {
    throw new Error("Missing 'DB_CONNECTION_URL' env var.");
  }
  if (!constants.SECRET) {
    throw new Error('Missing "SECRET" env variable');
  }
  if (!constants.FUNDING_SERVICE_URL) {
    throw new Error('Missing "FUNDING_SERVICE_URL" env variable');
  }

  // init db
  const connectionString = process.env.DB_CONNECTION_URL;
  const dbPool = new Pool({ connectionString });
  const dbInst = pgp()({ connectionString });

  start({
    baseQuota: constants.BASE_QUOTA,
    fundingServiceUrl: constants.FUNDING_SERVICE_URL!,
    db: dbInst,
    dbPool,
    secret: constants.SECRET!,
    availabilityMonitorUrl: constants.AVAILABILITY_MONITOR_URL,
  });
};

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  main();
}
