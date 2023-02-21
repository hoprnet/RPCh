import {
  DBInstance,
  runInitialSqlDump,
  runMigrations,
  updateRegisteredNode,
} from "./db";
import { entryServer } from "./entry-server";
import { FundingServiceApi } from "./funding-service-api";
import { createLogger } from "./utils";
import pgp from "pg-promise";
import { getRegisteredNodes } from "./registered-node";
import { checkCommitment } from "./graph-api";
import * as constants from "./constants";

const log = createLogger();

const main = () => {
  if (!constants.FUNDING_SERVICE_URL)
    throw new Error('Missing "FUNDING_SERVICE_URL" env variable');

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
    baseQuota: constants.BASE_QUOTA,
    db: dbInstance,
    fundingServiceUrl: constants.FUNDING_SERVICE_URL!,
  });
};

const start = async (ops: {
  db: DBInstance;
  baseQuota: number;
  fundingServiceUrl: string;
}) => {
  await ops.db.connect();
  // run db migrations but filters out initial migration
  await runMigrations(constants.DB_CONNECTION_URL!);

  // init services
  const fundingServiceApi = new FundingServiceApi(
    ops.fundingServiceUrl,
    ops.db
  );

  const server = entryServer({
    db: ops.db,
    baseQuota: ops.baseQuota,
    fundingServiceApi: fundingServiceApi,
  });
  // start listening at PORT for requests
  server.listen(constants.PORT, "0.0.0.0", () => {
    log.normal("entry server is up");
  });

  // keep track of all pending funding requests to update status or retry
  const checkForPendingRequests = setInterval(async () => {
    try {
      log.normal("tracking pending requests");
      await fundingServiceApi.checkForPendingRequests();
    } catch (e) {
      log.error("Failed to track pending requests", e);
    }
  }, 1000);

  // check if fresh nodes have committed
  const checkCommitmentForFreshNodes = setInterval(async () => {
    try {
      log.normal("tracking commitment for fresh nodes");
      const freshNodes = await getRegisteredNodes(ops.db, {
        status: "FRESH",
      });

      for (const node of freshNodes ?? []) {
        log.verbose("checking commitment of fresh node", node);

        const nodeIsCommitted = await checkCommitment({
          node,
          minBalance: constants.BALANCE_THRESHOLD,
          minChannels: constants.CHANNELS_THRESHOLD,
        });

        log.verbose("node commitment", nodeIsCommitted);
        if (nodeIsCommitted) {
          log.verbose("new committed node", node.id);
          await updateRegisteredNode(ops.db, { ...node, status: "READY" });
        }
      }
    } catch (e) {
      log.error("Failed to check commitment for fresh nodes", e);
    }
  }, 1000);

  return () => {
    clearInterval(checkForPendingRequests);
    clearInterval(checkCommitmentForFreshNodes);
  };
};

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  main();
}
