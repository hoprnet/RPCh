import dotenv from "dotenv";
import * as AccessToken from "./access-token";
import { AccessTokenService } from "./access-token";
import { RequestService } from "./request";

import * as api from "./entry-server";
import { DBInstance } from "./db";

dotenv.config({ path: ".env.local" });

const { SECRET_KEY } = process.env;
const port = 3000;

export const start = async (ops: {
  _entryServer: {
    entryServer: typeof api.entryServer;
  };
  _AccessTokenService: typeof AccessTokenService;
  _RequestService: typeof RequestService;
  _db: DBInstance;
}) => {
  // init services
  const accessTokenService = new ops._AccessTokenService(ops._db);
  const requestService = new ops._RequestService(ops._db);
  // init API server
  const app = api.entryServer({ accessTokenService, requestService });
  app.listen(port, () => {});
};

const main = () => {
  if (!SECRET_KEY) {
    throw Error("env variable 'secret key' not found");
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
  });
};

main();
