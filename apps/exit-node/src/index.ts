import { type Request, Cache, utils, Segment } from "rpch-commons";
import { sendRpcRequest } from "./exit";
import { createMessageListener, sendMessage } from "./hoprd";

const { createLogger } = utils;
const { log, logError } = createLogger("exit-node");

const {
  HOPRD_API_ENDPOINT,
  HOPRD_API_TOKEN,
  RESPONSE_TIMEOUT_STR = "10000",
} = process.env;

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

const start = async (ops: {
  timeout: number;
  apiEndpoint: string;
  apiToken?: string;
}): Promise<() => void> => {
  const onRequest = async (rpchRequest: Request) => {
    try {
      const response = await sendRpcRequest(
        rpchRequest.body,
        rpchRequest.provider
      );
      const rpchResponse = rpchRequest.createResponse(response);
      await sendMessage({
        apiEndpoint: ops.apiEndpoint,
        apiToken: ops.apiToken,
        message: rpchResponse.toMessage().body,
        destination: rpchRequest.origin,
      });
    } catch {
      logError("failed");
    }
  };

  const cache = new Cache(ops.timeout, onRequest, () => {});

  const stopExitNode = await createMessageListener(
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
    stopExitNode();
  };
};

start({
  apiEndpoint: HOPRD_API_ENDPOINT,
  apiToken: HOPRD_API_TOKEN,
  timeout: RESPONSE_TIMEOUT,
});
