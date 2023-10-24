import { check } from "k6";
import http from "k6/http";
import { JsonRpcMethod, JsonRpcPayload } from "../types.js";
import { JsonRpcMethodCounters, MockWallet } from "./mock-wallet.js";
import { getMethodFromPayload, getPayload } from "../utils/rpc-payload.js";

export class MockDummyWallet extends MockWallet implements MockWallet {
    protected buildRequestBodies(): JsonRpcPayload[] {
      const requests = [];
      requests.push(getPayload(JsonRpcMethod.GET_TX_COUNT));
      requests.push(getPayload(JsonRpcMethod.GET_TX_COUNT));
      // requests.push(getRequest(JsonRpcMethod.GET_TX_COUNT));
      return requests
    }
  
    public sendRpcCalls(counters: JsonRpcMethodCounters): void {
        for (let i = 0; i < this.bodies.length; i++) {
            const reqBody = getMethodFromPayload(this.bodies[i]);
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