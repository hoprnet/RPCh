// createMessageListener() -> cache (commons) -> onRequest() -> updateRequestTracker(), sendRpcRequest() -> sendMessage(), updateRequestTracker() <<remove old request>>
import * as exit from "./exit";
import { Request, Segment } from "rpch-commons";


const { HOPRD_API_ENDPOINT, HOPRD_API_TOKEN } = process.env;

// Validate enviroment variables
if (!HOPRD_API_ENDPOINT) {
  throw Error("env variable 'HOPRD_API_ENDPOINT' not found");
}
if (!HOPRD_API_TOKEN) {
  throw Error("env variable 'HOPRD_API_TOKEN' not found");
}

// const start = async (ops: {})
