/**
 * Responsible for managing the whole functionality of the exit-node.
 */
// createMessageListener() -> cache (commons) -> onRequest() -> updateRequestTracker(), sendRpcRequest() -> sendMesage(), updateRequestTracker() <<remove old request>>
import { Cache, utils } from "rpch-commons";
import { createMessageListener, sendMessage } from "./hoprd";
import { sendRpcRequest } from "./exit";
import RequestTracker from "./request-tracker";
const { createLogger } = utils;

const { log } = createLogger("exit");

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
  apiEndpoint: string;
  apiToken?: string;
  timeout: number;
}) => {
  const stopExitNode = createMessageListener(
    ops.apiEndpoint,
    ops.apiToken,
    (message: string) => {
      const requestTracker = new RequestTracker(ops.timeout);
      try {
        new Cache(
          ops.timeout,
          (request) => {
            requestTracker.onRequest(request);
            sendRpcRequest(request.body, request.provider);
          },
          (response) => {
            sendMessage(
              ops.apiEndpoint,
              ops.apiToken,
              response.body,
              ops.apiEndpoint
            );
            requestTracker.onResponse(response);
          }
        );
      } catch (error) {
        log("Rejected received data from HOPRd: not a valid message", message);
      }

      const interval = requestTracker.setInterval();

      return () => {
        clearInterval(interval);
        stopExitNode();
      };
    }
  );
};

start({
  apiEndpoint: HOPRD_API_ENDPOINT,
  apiToken: HOPRD_API_TOKEN,
  timeout: RESPONSE_TIMEOUT,
});
