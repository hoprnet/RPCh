import * as entryServer from "./entry-server";
import dotenv from "dotenv";
import DBAdapter from "./db";
dotenv.config({ path: ".env.local" });

const { SECRET_KEY } = process.env;

const start = async () => {
  const db = DBAdapter.getInstance();

  entryServer.startServer();

  return () => {
    db.quit();
  };
};

const main = () => {
  if (!SECRET_KEY) {
    throw Error("env variable 'secret key' not found");
  }

  start();
};

main();
