import dotenv from "dotenv";
import { AccessTokenService } from "./access-token";
import { getWallet } from "./blockchain";
import { DBInstance } from "./db";
import { checkFreshRequests } from "./queue";
import * as api from "./entry-server";
import { RequestService } from "./request";

dotenv.config({ path: ".env.local" });

const { SECRET_KEY, PRIV_KEY } = process.env;
const port = 3000;
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
  const app = api.entryServer({ accessTokenService, requestService });
  setInterval(() => {
    if (!running) {
      checkFreshRequests({
        requestService: requestService,
        signer: wallet,
        confirmations: 1,
        changeState: handleRunning,
      });
    }
  }, 1e3);
  app.listen(port, () => {});
};

const main = () => {
  if (!SECRET_KEY) {
    throw Error("env variable 'SECRET_KEY' not found");
  }
  if (!PRIV_KEY) {
    throw Error("env variable 'PRIV_KEY' not found");
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
    _privateKey: PRIV_KEY,
    _secretKey: SECRET_KEY,
  });
};

main();
