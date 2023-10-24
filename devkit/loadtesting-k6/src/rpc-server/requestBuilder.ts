// import { RefinedParams, RequestBody, ResponseType } from "k6/http";
import { check, sleep } from 'k6'
import http, { RefinedParams } from "k6/http";
import { Counter } from "k6/metrics";
import { JsonRpcMethod, JsonRpcMethodTypes, JsonRpcPayload, Wallet, WalletTypes } from "./types.js";

// const URL =
//   __ENV.RPC_SERVER_URL ||
//   "http://localhost:8080/?exit-provider=https://gnosis-provider.rpch.tech";

// const PARAMS = {
//   headers: {
//     accept: "application/json",
//     "content-type": "application/json",
//   },
// };

export type JsonRpcMethodCounters = Record<JsonRpcMethodTypes, Counter>

export abstract class MockWallet {
  protected url: string
  protected params: RefinedParams<"text"> = {}
  protected bodies: JsonRpcPayload[] = []
  // public counters: JsonRpcMethodCounters

  public constructor(url?: string) {
    this.url = url || "http://localhost:8080/?exit-provider=https://gnosis-provider.rpch.tech";
    this.params = {
        headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
    }
    this.bodies = this.buildRequestBodies();
    // this.counters = this.instantiateCounters();
  }

  // protected instantiateCounters(): JsonRpcMethodCounters {
  //   const counters: JsonRpcMethodCounters = {} as JsonRpcMethodCounters;
  //   for (const key in JsonRpcMethod) {
  //     // if (isNaN(Number(key))) {
  //       const method = key as JsonRpcMethodTypes;
  //       counters[method] = new Counter(method);
  //     // }
  //   }
  //   return counters;
  // }

  protected abstract buildRequestBodies(): JsonRpcPayload[];

  abstract sendRpcCalls(counters: JsonRpcMethodCounters): void;

  protected sleep(min = 1, max = 2) {
    sleep(Math.floor(Math.random() * (max - min) + min))
  }
}

export class MockDummyWallet extends MockWallet implements MockWallet {
  protected buildRequestBodies(): JsonRpcPayload[] {
    const requests = [];
    requests.push(getRequest(JsonRpcMethod.GET_TX_COUNT));
    // requests.push(getRequest(JsonRpcMethod.GET_TX_COUNT));
    // requests.push(getRequest(JsonRpcMethod.GET_TX_COUNT));
    return requests
  }

  public sendRpcCalls(counters: JsonRpcMethodCounters): void {
      for (let i = 0; i < this.bodies.length; i++) {
        const reqBody = getMethodFromRequest(this.bodies[i]);
        if (!reqBody) {
          console.log("Cannot find the method");
          return;
        }
        // update counter
        counters[reqBody].add(1);
        const res = http.post(this.url, JSON.stringify(this.bodies[i]), this.params);
        
        // Validate response status
        check(res, {
          "status was 200": (r) => r.status == 200,
          "verify resp": (r) =>
            typeof r.body == "string" &&
            r.body.includes("jsonrpc") &&
            !r.body.includes("error"),
        });

        this.sleep();
      }
  }
}

export function buildWallet(walletType: WalletTypes, url?: string): MockWallet {
  switch (Wallet[walletType]) {
    case Wallet.DUMMY_SMALL:
      break;
    default:
      break;
  }
  return new MockDummyWallet(url);
}

export function instantiateCounters(): JsonRpcMethodCounters {
  const counters: JsonRpcMethodCounters = {} as JsonRpcMethodCounters;
  for (const key in JsonRpcMethod) {
    // if (isNaN(Number(key))) {
      const method = key as JsonRpcMethodTypes;
      counters[method] = new Counter(method);
    // }
  }
  return counters;
}

// url: string
// body: RequestBody = {}
// params: RefinedParams<ResponseType> = {}
export function getRequest(
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

export function getMethodFromRequest(request: JsonRpcPayload): JsonRpcMethodTypes | undefined {
  for (const key in JsonRpcMethod) {
    const method = key as JsonRpcMethodTypes;
    if (JsonRpcMethod[method] === request.method) {
      return key as JsonRpcMethodTypes;
    }
  }
  return undefined;
}
