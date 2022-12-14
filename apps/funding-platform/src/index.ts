import { utils } from "rpch-common";
import { AccessTokenService } from "./access-token";
import { getWallet } from "./blockchain";
import { DBInstance } from "./db";
import * as api from "./entry-server";
import { checkFreshRequests } from "./queue";
import { RequestService } from "./request";

const { log } = utils.createLogger(["funding-platform"]);

const {
  // Secret key used for access token generation
  SECRET_KEY,
  // Wallet private key that will be completing the requests
  WALLET_PRIV_KEY,
  // Port that server will listen for requests
  PORT = 3000,
  // Number of confirmations that will be required for a transaction to be accepted
  CONFIRMATIONS = 1,
  // Max amount of tokens a access token can request
  MAX_AMOUNT_OF_TOKENS = 100,
  // Amount of minutes that a access token is valid
  TIMEOUT = 30,
} = process.env;

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
  // init services
  const accessTokenService = new AccessTokenService(ops.db, ops.secretKey);
  const requestService = new RequestService(ops.db);
  const wallet = getWallet(ops.privateKey);
  // init API server
  const app = api.entryServer({
    accessTokenService,
    requestService,
    walletAddress: wallet.address,
    maxAmountOfTokens: Number(MAX_AMOUNT_OF_TOKENS),
    timeout: Number(TIMEOUT),
  });
  // start queue that fulfills requests
  setInterval(() => {
    if (!running) {
      checkFreshRequests({
        requestService: requestService,
        signer: wallet,
        confirmations: ops.confirmations,
        changeState: handleRunning,
      });
    }
  }, 60e3);
  app.listen(PORT, () => {
    log("entry server is up");
  });
};

const main = () => {
  if (!SECRET_KEY) {
    throw Error("env variable 'SECRET_KEY' not found");
  }
  if (!WALLET_PRIV_KEY) {
    throw Error("env variable 'WALLET_PRIV_KEY' not found");
  }
  // init db
  const dbInstance = {
    data: {
      requests: [],
      accessTokens: [],
    },
  } as unknown as DBInstance;

  start({
    entryServer: api,
    db: dbInstance,
    privateKey: WALLET_PRIV_KEY,
    secretKey: SECRET_KEY,
    confirmations: Number(CONFIRMATIONS),
  });
};

main();
