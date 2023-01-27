import * as path from "path";
import levelup from "levelup";
import leveldown from "leveldown";
import RPChSDK from "@rpch/sdk";
import * as server from "./server";
import { createLogger } from "./utils";

const log = createLogger();

const {
  DATA_DIR = path.join(process.cwd(), "db"),
  PORT = 3003,
  RESPONSE_TIMEOUT: RESPONSE_TIMEOUT_STR = "10000",
  DISCOVERY_PLATFORM_API_ENDPOINT,
} = process.env;

export const start = async (ops: {
  server: {
    createServer: typeof server.createServer;
  };
  dataDir: string;
  timeout: number;
  discoveryPlatformApiEndpoint: string;
}): Promise<() => void> => {
  const sdk = new RPChSDK(
    {
      timeout: ops.timeout,
      discoveryPlatformApiEndpoint: ops.discoveryPlatformApiEndpoint,
    },
    async (clientId, counter) => {
      await db.put(clientId, counter);
    },
    async (clientId) => {
      try {
        const val = await db.get(clientId);
        return val.toString();
      } catch {
        return "0";
      }
    }
  );

  log.verbose("Initializing DB at", ops.dataDir);
  const db = levelup(leveldown(ops.dataDir));

  log.normal("Starting rpc-server");
  const stopServer = ops.server.createServer(
    "0.0.0.0",
    Number(PORT),
    async (body, response, exitProvider) => {
      try {
        const rpcRequest = await sdk.createRequest(exitProvider, body);
        const rpcResponse = await sdk.sendRequest(rpcRequest);
        response.write(rpcResponse.body);
        response.statusCode = 200;
        response.end();
      } catch {
        response.statusCode = 400;
        response.end();
      }
    }
  );

  return () => {
    stopServer();
  };
};

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  const RESPONSE_TIMEOUT = Number(RESPONSE_TIMEOUT_STR);
  if (isNaN(RESPONSE_TIMEOUT)) {
    throw Error("env variable 'RESPONSE_TIMEOUT' not a number");
  }

  if (!DISCOVERY_PLATFORM_API_ENDPOINT) {
    throw Error("env variable 'DISCOVERY_PLATFORM_API_ENDPOINT' is not set");
  }

  log.normal("Starting rpc-server");

  start({
    server,
    dataDir: DATA_DIR,
    timeout: RESPONSE_TIMEOUT,
    discoveryPlatformApiEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
  }).catch((error) => log.error(error));
}
