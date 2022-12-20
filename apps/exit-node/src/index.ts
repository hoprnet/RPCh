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

const { log, logError } = utils.createLogger("exit-node");

const {
  PRIVATE_KEY,
  HOPRD_API_ENDPOINT,
  HOPRD_API_TOKEN,
  RESPONSE_TIMEOUT: RESPONSE_TIMEOUT_STR = "10000",
} = process.env;

let lastRequestFromClient = BigInt(0);

export const start = async (ops: {
  exit: {
    sendRpcRequest: typeof exit.sendRpcRequest;
  };
  hoprd: {
    sendMessage: typeof hoprd.sendMessage;
    createMessageListener: typeof hoprd.createMessageListener;
    fetchPeerId: typeof hoprd.fetchPeerId;
  };
  privateKey: string;
  apiEndpoint: string;
  apiToken?: string;
  timeout: number;
}): Promise<() => void> => {
  const getMyPeerId = async () => {
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
      const rpchRequest = Request.fromMessage(
        message,
        myIdentity,
        lastRequestFromClient,
        (counter) => {
          lastRequestFromClient = counter;
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
          destination: rpchRequest.entryNode.peerId.toB58String(),
        });
      }
    } catch (error) {
      logError("Failed to respond with data", error);
    }
  };

  const myPeerId = await getMyPeerId();
  const myIdentity = new utils.Identity(myPeerId!, ops.privateKey);
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
  if (!PRIVATE_KEY) {
    throw Error("env variable 'PRIVATE_KEY' not found");
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
    privateKey: PRIVATE_KEY,
    apiEndpoint: HOPRD_API_ENDPOINT,
    apiToken: HOPRD_API_TOKEN,
    timeout: RESPONSE_TIMEOUT,
  }).catch(console.error);
}
