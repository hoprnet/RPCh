import * as path from "path";
import levelup from "levelup";
import leveldown from "leveldown";
import { utils as ethersUtils } from "ethers";
import {
  type Message,
  Request,
  Response,
  Cache,
  utils,
  Segment,
  hoprd,
} from "rpch-common";
import * as exit from "./exit";
import * as identity from "./identity";

const { log, logError } = utils.createLogger("exit-node");

const {
  RPCH_PASSWORD,
  RPCH_IDENTITY_DIR,
  RPCH_PRIVATE_KEY: RPCH_PRIVATE_KEY_STR,
  RPCH_DATA_DIR,
  HOPRD_API_ENDPOINT,
  HOPRD_API_TOKEN,
  RESPONSE_TIMEOUT: RESPONSE_TIMEOUT_STR = "10000",
} = process.env;

const DEFAULT_IDENTITY_DIR = path.join(process.cwd(), ".rpch-identity");
const DEFAULT_DATA_DIR = path.join(process.cwd(), "db");

export const start = async (ops: {
  exit: {
    sendRpcRequest: typeof exit.sendRpcRequest;
  };
  hoprd: {
    sendMessage: typeof hoprd.sendMessage;
    createMessageListener: typeof hoprd.createMessageListener;
    fetchPeerId: typeof hoprd.fetchPeerId;
  };
  privateKey?: Uint8Array;
  identityDir: string;
  password?: string;
  dataDir: string;
  apiEndpoint: string;
  apiToken?: string;
  timeout: number;
}): Promise<() => void> => {
  const fetchMyPeerId = async () => {
    const result = await ops.hoprd.fetchPeerId({
      apiEndpoint: ops.apiEndpoint,
      apiToken: ops.apiToken,
    });
    if (result) {
      return result.listeningAddress[0].split("/").pop();
    }
  };

  const onMessage = async (message: Message) => {
    try {
      const [clientId] = utils.splitBodyToParts(message.body);
      const lastRequestFromClient: bigint = await db
        .get(clientId)
        .then((v) => {
          return BigInt(v.toString());
        })
        .catch(() => BigInt(0));

      const rpchRequest = Request.fromMessage(
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

      const rpchResponse = Response.createResponse(rpchRequest, response);
      for (const segment of rpchResponse.toMessage().toSegments()) {
        ops.hoprd.sendMessage({
          apiEndpoint: ops.apiEndpoint,
          apiToken: ops.apiToken,
          message: segment.toString(),
          destination: rpchRequest.entryNodeDestination,
        });
      }
    } catch (error) {
      logError("Failed to respond with data", error);
    }
  };

  const db = levelup(leveldown(ops.dataDir));

  const myPeerId = await fetchMyPeerId();
  if (!myPeerId) throw Error("");

  const myIdentity = await identity.getIdentity({
    identityDir: ops.identityDir,
    password: ops.password,
    privateKey: ops.privateKey,
  });
  const cache = new Cache(onMessage);
  const interval: NodeJS.Timer = setInterval(() => {
    cache.removeExpired(ops.timeout);
  }, 1000);

  const stopMessageListening = await ops.hoprd.createMessageListener(
    ops.apiEndpoint,
    ops.apiToken || "",
    (message: string) => {
      try {
        const segment = Segment.fromString(message);
        cache.onSegment(segment);
      } catch (error) {
        log("Rejected received data from HOPRd: not a valid message", message);
      }
    }
  );

  return () => {
    clearInterval(interval);
    stopMessageListening();
  };
};

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  // Validate enviroment variables
  if (!RPCH_PRIVATE_KEY_STR && !RPCH_PASSWORD) {
    throw Error(
      "env variable 'RPCH_PRIVATE_KEY' and 'RPCH_PASSWORD' not found"
    );
  }
  if (!HOPRD_API_ENDPOINT) {
    throw Error("env variable 'HOPRD_API_ENDPOINT' not found");
  }
  if (!HOPRD_API_TOKEN) {
    throw Error("env variable 'HOPRD_API_TOKEN' not found");
  }

  const RESPONSE_TIMEOUT = Number(RESPONSE_TIMEOUT_STR);
  if (isNaN(RESPONSE_TIMEOUT)) {
    throw Error("env variable 'RESPONSE_TIMEOUT' not a number");
  }

  start({
    exit,
    hoprd,
    privateKey: RPCH_PRIVATE_KEY_STR
      ? ethersUtils.arrayify(RPCH_PRIVATE_KEY_STR)
      : undefined,
    identityDir: RPCH_IDENTITY_DIR || DEFAULT_IDENTITY_DIR,
    password: RPCH_PASSWORD,
    dataDir: RPCH_DATA_DIR || DEFAULT_DATA_DIR,
    apiEndpoint: HOPRD_API_ENDPOINT,
    apiToken: HOPRD_API_TOKEN,
    timeout: RESPONSE_TIMEOUT,
  }).catch(console.error);
}
