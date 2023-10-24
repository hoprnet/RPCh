import { Counter } from "k6/metrics";
import { JsonRpcMethod, JsonRpcMethodTypes, JsonRpcPayload } from "../types.js";
import { JsonRpcMethodCounters } from '../wallet/mock-wallet.js';

export function instantiatePayloadCounters(): JsonRpcMethodCounters {
  const counters: JsonRpcMethodCounters = {} as JsonRpcMethodCounters;
  for (const key in JsonRpcMethod) {
    const method = key as JsonRpcMethodTypes;
    counters[method] = new Counter(method);
  }
  return counters;
}

// url: string
// body: RequestBody = {}
// params: RefinedParams<ResponseType> = {}
export function getPayload(
  request: JsonRpcMethod
): JsonRpcPayload {
  let jsonBody: JsonRpcPayload = {
    jsonrpc: "2.0",
    id: 0,
    method: "eth_blockNumber",
    params: [],
  };

  switch (request) {
    case JsonRpcMethod.GET_BLOCKNUMBER:
      break;
    case JsonRpcMethod.GET_TX_COUNT:
      jsonBody = {
        ...jsonBody,
        method: "eth_getBlockTransactionCountByNumber",
        params: ["latest"],
      };
      break;
    case JsonRpcMethod.CALL:
      jsonBody = {
        ...jsonBody,
        method: "eth_call",
        params: [
          {
            to: "0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e",
            data: "0x0178b8bf055c338dd6efeb3b4696940a72759f266b74f3e35de5fa6be05676e417f6dff4",
          },
          "latest",
        ],
      };
      break;
    case JsonRpcMethod.GET_CODE:
      jsonBody = {
        ...jsonBody,
        method: "eth_getCode",
        params: ["0xd4fdec44db9d44b8f2b6d529620f9c0c7066a2c1", "latest"],
      };
      break;
    default:
      console.log("cannot match request method");
  }
  return jsonBody;
}

export function getMethodFromPayload(request: JsonRpcPayload): JsonRpcMethodTypes | undefined {
  for (const key in JsonRpcMethod) {
    const method = key as JsonRpcMethodTypes;
    if (JsonRpcMethod[method] === request.method) {
      return key as JsonRpcMethodTypes;
    }
  }
  return undefined;
}
