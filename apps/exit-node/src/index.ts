import { type Request, Cache, utils, Segment, hoprd, crypto } from "rpch-common";
import * as exit from "./exit";

const { log, logError } = utils.createLogger("exit-node");

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
      // We need to box the response.
      const response = await ops.exit.sendRpcRequest(
        rpchRequest.body,
        rpchRequest.provider
      );
      // Using box_response from crypto
      const boxedResponse = new TextEncoder().encode(response)
      // Where can I get these values from at the exit node?
      let entryNodePeerId = "16Uiu...";
      let ourExitNodePeerId = "16Uiu2...";
      const session = crypto.box_response(/*sesion*/, new crypto.Envelope(boxedResponse, entryNodePeerId, ourExitNodePeerId), null);

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

  const cache = new Cache(onRequest, () => { });
  const interval: NodeJS.Timer = setInterval(() => {
    cache.removeExpired(ops.timeout);
  }, 1000);

  const stopMessageListening = await ops.hoprd.createMessageListener(
    ops.apiEndpoint,
    ops.apiToken || "",
    (message: string) => {
      try {
        // Transform the request to Uint8Array as it comes as a string, turn array strings into numbers.
        const messageArray = message.split(',').map(x => parseInt(x))
        const boxedRequestData = Uint8Array.from(messageArray)

        // Where can I get these values from at the exit node?
        let entryNodePeerId = "16Uiu...";
        let ourExitNodePeerId = "16Uiu2...";
        let myExitNodeId = crypto.Identity.load_identity(new Uint8Array, undefined);
        let session = crypto.unbox_request(new crypto.Envelope(boxedRequestData, entryNodePeerId, ourExitNodePeerId), myExitNodeId);
        let unboxedRequest = session.get_request_data();

        // Decode the Uint8Array to a string.
        let unboxedRequestString = new TextDecoder().decode(unboxedRequest);

        const segment = Segment.fromString(unboxedRequestString);
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
