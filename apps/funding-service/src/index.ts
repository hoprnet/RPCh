import pgp from "pg-promise";
import { AccessTokenService } from "./access-token";
import { blockchain } from "@rpch/common";
import { runMigrations } from "./db";
import * as api from "./entry-server";
import { checkFreshRequests } from "./queue";
import { RequestService } from "./request";
import { createLogger } from "./utils";
import { DBInstance } from "./types";
import * as constants from "./constants";
import Prometheus from "prom-client";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import { runMigrations } from "@rpch/common/build/internal/db";
import migrate from "node-pg-migrate";
import path from "path";

const log = createLogger();

// boolean flag that stops queue from running
// while it is still waiting for a transaction
let running = false;
const handleRunning = (state: boolean) => {
  running = state;
};

const start = async (ops: {
  entryServer: {
    entryServer: typeof api.entryServer;
  };
  db: DBInstance;
  secretKey: string;
  privateKey: string;
  confirmations: number;
}) => {
  // run db migrations
  const migrationsDirectory = path.join(__dirname, "../migrations");
  await runMigrations(
    constants.DB_CONNECTION_URL!,
    migrationsDirectory,
    migrate
  );

  // init services
  const accessTokenService = new AccessTokenService(ops.db, ops.secretKey);
  const requestService = new RequestService(ops.db);
  const wallet = blockchain.getWallet(ops.privateKey);

  // create prometheus registry
  const register = new Prometheus.Registry();
  register.setDefaultLabels({
    app: constants.METRIC_PREFIX,
  });

  const metricManager = new MetricManager(
    Prometheus,
    register,
    constants.METRIC_PREFIX
  );

  // init API server
  const app = api.entryServer({
    accessTokenService,
    requestService,
    walletAddress: wallet.address,
    maxAmountOfTokens: constants.MAX_AMOUNT_OF_TOKENS,
    timeout: constants.TIMEOUT,
    metricManager: metricManager,
  });
  // start queue that fulfills requests
  setInterval(() => {
    log.normal("running queue for fresh requests");
    if (!running) {
      checkFreshRequests({
        requestService: requestService,
        signer: wallet,
        confirmations: ops.confirmations,
        changeState: handleRunning,
        metricManager: metricManager,
      });
    }
  }, 30e3);
  // start listening at PORT for requests
  app.listen(constants.PORT, () => {
    log.normal("entry server is up");
  });
};

const main = () => {
  if (!constants.SECRET_KEY) {
    throw Error("env variable 'SECRET_KEY' not found");
  }
  if (!constants.WALLET_PRIV_KEY) {
    throw Error("env variable 'WALLET_PRIV_KEY' not found");
  }
  if (!constants.DB_CONNECTION_URL) {
    throw Error("env variable 'DB_CONNECTION_URL' not found");
  }
  // init db
  const pgInstance = pgp();
  const connectionString: string = constants.DB_CONNECTION_URL!;
  const dbInstance = pgInstance({
    connectionString,
  });

  start({
    entryServer: api,
    db: dbInstance,
    privateKey: constants.WALLET_PRIV_KEY!,
    secretKey: constants.SECRET_KEY!,
    confirmations: constants.CONFIRMATIONS,
  });
};

main();
