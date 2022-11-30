import * as entryServer from "./entry-server";
import dotenv from "dotenv";
import { DBAdapter } from "db";
import { AccessTokenService } from "access-token";
dotenv.config({ path: ".env.local" });

const { SECRET_KEY } = process.env;

const start = async () => {
  const db = undefined;
  const dbAdapter = new DBAdapter(db);
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
