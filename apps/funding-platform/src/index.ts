import * as entryServer from "./entry-server";
import dotenv from "dotenv";
dotenv.config();

const { SECRET_KEY } = process.env;

const start = async (ops: { secretKey: string }) => {
  entryServer.startServer({
    secretKey: ops.secretKey,
  });
};

if (!SECRET_KEY) {
  throw Error("env variable 'secret key' not found");
}

start({
  secretKey: SECRET_KEY,
});
