import dotenv from "dotenv";
import * as AccessToken from "./access-token";
import { AccessTokenService } from "./access-token";
import * as api from "./entry-server";
import { DBInstance } from "./db";

dotenv.config({ path: ".env.local" });

const { SECRET_KEY } = process.env;
const port = 3000;

export const start = async (ops: {
  _entryServer: {
    entryServer: typeof api.entryServer;
  };
  _AccessTokenService: typeof AccessToken.AccessTokenService;
  _db: DBInstance;
}) => {
  // init services
  const accessTokenService = new ops._AccessTokenService(ops._db);
  // init API server
  const app = api.entryServer({ accessTokenService });
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
    _db: dbInstance,
  });
};

main();
