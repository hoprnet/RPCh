import { AccessTokenService } from "./access-token";
import { getWallet } from "./blockchain";
import { DBInstance } from "./db";
import * as api from "./entry-server";
import { checkFreshRequests } from "./queue";
import { RequestService } from "./request";

const { SECRET_KEY, WALLET_PRIV_KEY } = process.env;
const port = 3000;
const MAX_AMOUNT_OF_TOKENS = 100;
const TIMEOUT = 30;
let running = false;

const handleRunning = (state: boolean) => {
  running = state;
};

export const start = async (ops: {
  _entryServer: {
    entryServer: typeof api.entryServer;
  };
  _AccessTokenService: typeof AccessTokenService;
  _RequestService: typeof RequestService;
  _db: DBInstance;
  _secretKey: string;
  _privateKey: string;
}) => {
  // init services
  const accessTokenService = new ops._AccessTokenService(
    ops._db,
    ops._secretKey
  );
  const requestService = new ops._RequestService(ops._db);
  const wallet = getWallet(ops._privateKey);
  // init API server
  const app = api.entryServer({
    accessTokenService,
    requestService,
    walletAddress: wallet.address,
    maxAmountOfTokens: MAX_AMOUNT_OF_TOKENS,
    timeout: TIMEOUT,
  });
  setInterval(() => {
    if (!running) {
      checkFreshRequests({
        requestService: requestService,
        signer: wallet,
        confirmations: 1,
        changeState: handleRunning,
      });
    }
  }, 60e3);
  app.listen(port, () => {});
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
    _entryServer: api,
    _AccessTokenService: AccessTokenService,
    _RequestService: RequestService,
    _db: dbInstance,
    _privateKey: WALLET_PRIV_KEY,
    _secretKey: SECRET_KEY,
  });
};

main();
