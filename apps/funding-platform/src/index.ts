import * as entryServer from "./entry-server.js";

const { SECRET_KEY } = process.env;

const start = async (ops: { secretKey: string }) => {
  entryServer.startServer({
    secretKey: ops.secretKey,
  });
};

export default start;
// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  // Validate enviroment variables
  if (!SECRET_KEY) {
    throw Error("env variable 'HOPRD_API_ENDPOINT' not found");
  }

  start({
    secretKey: SECRET_KEY,
  });
}
