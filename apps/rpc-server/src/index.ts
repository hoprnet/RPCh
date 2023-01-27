import * as path from "path";
import levelup from "levelup";
import leveldown from "leveldown";
import { Request, Response, type Message, Cache, utils } from "@rpch/common";
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
      db.put(clientId, counter);
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

  const onMessage = async (message: Message) => {
    try {
      // in the method, we are only expecting to receive
      // Requests, this means that the all messages are
      // prefixed by the entry node's peer id
      const [clientId] = utils.splitBodyToParts(message.body);

      // if this fails, then we most likely have received
      // a Response
      try {
        PeerId.createFromB58String(clientId);
      } catch {
        log.verbose("Ignoring Response as we are an exit node");
      }

      const lastRequestFromClient: bigint = await db
        .get(clientId)
        .then((v) => {
          return BigInt(v.toString());
        })
        .catch(() => BigInt(0));

      const rpchRequest = Request.fromMessage(
        crypto,
        message,
        myPeerId!,
        myIdentity,
        lastRequestFromClient,
        (clientId, counter) => {
          db.put(clientId, counter.toString());
        }
      );

      const response = await ops.exit.sendRpcRequest(
        rpchRequest.body,
        rpchRequest.provider
      );

      const rpchResponse = Response.createResponse(
        crypto,
        rpchRequest,
        response
      );
      for (const segment of rpchResponse.toMessage().toSegments()) {
        ops.hoprd.sendMessage({
          apiEndpoint: ops.apiEndpoint,
          apiToken: ops.apiToken,
          message: segment.toString(),
          destination: rpchRequest.entryNodeDestination,
        });
      }
    } catch (error) {
      log.error("Failed to respond with data", error);
    }
  };

  log.verbose("Initializing DB at", ops.dataDir);
  const db = levelup(leveldown(ops.dataDir));

  log.normal("Starting rpc-server");
  const stopServer = ops.server.createServer(
    "0.0.0.0",
    Number(PORT),
    (body, response, exitProvider) => {
      const request = sdk.createRequest(exitProvider, body);
      await sdk.sendRequest(request);
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
