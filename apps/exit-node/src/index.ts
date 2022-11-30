import { type Request, Cache, utils, Segment, hoprd } from "rpch-common";
import * as exit from "./exit";

const { createLogger } = utils;
const { log, logError } = createLogger("exit-node");

const {
  HOPRD_API_ENDPOINT,
  HOPRD_API_TOKEN,
  RESPONSE_TIMEOUT: RESPONSE_TIMEOUT_STR = "10000",
} = process.env;

const start = async (ops: {
  exit: {
    sendRpcRequest: typeof exit.sendRpcRequest;
  };
  hoprd: {
    sendMessage: typeof hoprd.sendMessage;
    createMessageListener: typeof hoprd.createMessageListener;
  };
  apiEndpoint: string;
  apiToken?: string;
  timeout: number;
}): Promise<() => void> => {
  const onRequest = async (rpchRequest: Request) => {
    try {
      const response = await ops.exit.sendRpcRequest(
        rpchRequest.body,
        rpchRequest.provider
      );
      const rpchResponse = rpchRequest.createResponse(response);
      await ops.hoprd.sendMessage({
        apiEndpoint: ops.apiEndpoint,
        apiToken: ops.apiToken,
        message: rpchResponse.toMessage().body,
        destination: rpchRequest.origin,
      });
    } catch (error) {
      logError("Failed to respond with data", error);
    }
  };

  const cache = new Cache(onRequest, () => {});
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

export default start;

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  // Validate enviroment variables
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
    apiEndpoint: HOPRD_API_ENDPOINT,
    apiToken: HOPRD_API_TOKEN,
    timeout: RESPONSE_TIMEOUT,
  });
}
