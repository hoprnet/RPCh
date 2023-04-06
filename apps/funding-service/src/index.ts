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
  await ops.db.connect();
  // run db migrations
  await runMigrations(constants.DB_CONNECTION_URL!);

  // init services
  const accessTokenService = new AccessTokenService(ops.db, ops.secretKey);
  const requestService = new RequestService(ops.db);
  const wallet = blockchain.getWallet(ops.privateKey);
  // init API server
  const app = api.entryServer({
    accessTokenService,
    requestService,
    walletAddress: wallet.address,
    maxAmountOfTokens: constants.MAX_AMOUNT_OF_TOKENS,
    timeout: constants.TIMEOUT,
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
