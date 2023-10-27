import { check } from "k6";
import http from "k6/http";
import { JsonRpcMethod, JsonRpcPayload } from "../types.js";
import { JsonRpcMethodCounters, MockWallet } from "./mock-wallet.js";
import { getMethodFromPayload, getRandomPayloadFromDapp, getStandardPayload } from "../utils/rpc-payload.js";

export class MockMetaMaskWallet extends MockWallet implements MockWallet {
    protected buildRequestBodies(): JsonRpcPayload[] {
        const requests = [];
        requests.push(getStandardPayload(JsonRpcMethod.GET_BLOCKNUMBER));
        requests.push(getStandardPayload(JsonRpcMethod.NET_VERSION));
        requests.push(getStandardPayload(JsonRpcMethod.GET_BLOCK));
        // gas price
        requests.push(getStandardPayload(JsonRpcMethod.GAS_PRICE));
        // get code of the current account
        requests.push(getStandardPayload(JsonRpcMethod.GET_CODE));
        // call
        requests.push(getStandardPayload(JsonRpcMethod.CALL));

        // get balance for all the accounts, here we assume 10
        requests.push(...new Array(10).fill(getStandardPayload(JsonRpcMethod.GET_BALANCE)))
        // get fee history
        requests.push(getStandardPayload(JsonRpcMethod.FEE_HISTORY))
        // using some dapp randomly
        requests.push(...getRandomPayloadFromDapp());
        
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