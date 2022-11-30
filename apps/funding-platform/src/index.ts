import dotenv from "dotenv";
import { Low } from "lowdb";
import { AccessTokenService, QueryAccessToken } from "./access-token";
import * as entryServer from "./entry-server";

dotenv.config({ path: ".env.local" });

const { SECRET_KEY } = process.env;

type Data = {
  accessTokens: QueryAccessToken[];
  requests: unknown[];
};

export type DBInstance = Low<Data>;

const start = async () => {
  const dbAdapter = {
    data: {
      requests: [],
      accessTokens: [],
    },
  } as unknown as DBInstance;

  const accessTokenService = new AccessTokenService(dbAdapter);
  entryServer.startServer({ db: dbAdapter, accessTokenService });
};

const main = () => {
  if (!SECRET_KEY) {
    throw Error("env variable 'secret key' not found");
  }

  start();
};

main();
