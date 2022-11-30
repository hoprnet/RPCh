import * as entryServer from "./entry-server";
import dotenv from "dotenv";
import { AccessTokenService } from "./access-token";
import { Memory, Low } from "lowdb";

dotenv.config({ path: ".env.local" });

const { SECRET_KEY } = process.env;

const start = async () => {
  const dbAdapter = new Low(new Memory());
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
