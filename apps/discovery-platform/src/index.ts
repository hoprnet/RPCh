import { DBInstance, updateRegisteredNode } from "./db";
import { entryServer } from "./entry-server";
import { FundingServiceApi } from "./funding-service-api";
import { createLogger } from "./utils";
import pgp from "pg-promise";
import { checkCommitmentForFreshNodes } from "./registered-node";
import { checkCommitment } from "./graph-api";
import * as constants from "./constants";
import * as Prometheus from "prom-client";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import { runMigrations } from "@rpch/common/build/internal/db";
import * as async from "async";
import path from "path";
import migrate from "node-pg-migrate";
import fetch from "node-fetch";
import type { RegisteredNodeDB } from "./types";

const log = createLogger();

const start = async (ops: {
  db: DBInstance;
  baseQuota: bigint;
  fundingServiceUrl: string;
  secret: string;
  availabilityMonitorUrl?: string;
}) => {
  // populated by availability monitor
  let unstableNodes: string[] = [];

  // run db migrations
  const migrationsDirectory = path.join(__dirname, "../migrations");
  await runMigrations(
    constants.DB_CONNECTION_URL!,
    migrationsDirectory,
    migrate
  );

  // init services
  const fundingServiceApi = new FundingServiceApi(
    ops.fundingServiceUrl,
    ops.db
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
    baseQuota: ops.baseQuota,
    fundingServiceApi: fundingServiceApi,
    metricManager: metricManager,
    secret: ops.secret,
    getUnstableNodes: () => unstableNodes,
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
        const nodeIsCommitted = await checkCommitment({
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

  // fetch node stability data
  const updateUnstableNodesInterval = setInterval(async () => {
    try {
      if (!ops.availabilityMonitorUrl) return;
      const results: [string, { isStable: boolean }][] = await fetch(
        ops.availabilityMonitorUrl
      ).then((res) => res.json());
      unstableNodes = Array.from(new Map(results).entries()).reduce<string[]>(
        (result, [peerId, { isStable }]) => {
          if (isStable) result.push(peerId);
          return result;
        },
        []
      );
      log.verbose(
        "Updated availability monitor nodes %i",
        unstableNodes.length
      );
    } catch (error) {
      log.error("Error fetching availability monitor nodes", error);
    }
  }, 30e3);

  return () => {
    clearInterval(checkCommitmentInterval);
    clearInterval(updateUnstableNodesInterval);
  };
};

const main = () => {
  if (!constants.FUNDING_SERVICE_URL)
    throw new Error('Missing "FUNDING_SERVICE_URL" env variable');

  if (!constants.DB_CONNECTION_URL) {
    throw new Error('Missing "DB_CONNECTION_URL" env variable');
  }
  if (!constants.SECRET) {
    throw new Error('Missing "SECRET" env variable');
  }

  // init db
  const pgInstance = pgp();
  const connectionString: string = constants.DB_CONNECTION_URL!;
  // create table if the table does not exist
  const dbInstance = pgInstance({
    connectionString,
  });

  start({
    baseQuota: constants.BASE_QUOTA,
    db: dbInstance,
    fundingServiceUrl: constants.FUNDING_SERVICE_URL!,
    secret: constants.SECRET!,
    availabilityMonitorUrl: constants.AVAILABILITY_MONITOR_URL,
  });
};

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  main();
}
