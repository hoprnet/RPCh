import { sleep } from "k6";
import { RefinedParams } from "k6/http";
import { Counter } from "k6/metrics";
import { JsonRpcMethodTypes, JsonRpcPayload } from "../types.js";

export type JsonRpcMethodCounters = Record<JsonRpcMethodTypes, Counter>

export abstract class MockWallet {
    protected url: string
    protected params: RefinedParams<"text"> = {}
    protected bodies: JsonRpcPayload[] = []
  
    public constructor(url?: string) {
      this.url = url || "http://localhost:8080/?exit-provider=https://gnosis-provider.rpch.tech";
      this.params = {
          headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
      }
      this.bodies = this.buildRequestBodies();
    }
  
    protected abstract buildRequestBodies(): JsonRpcPayload[];
  
    abstract sendRpcCalls(counters: JsonRpcMethodCounters): void;
  
    protected sleep(min = 1, max = 2) {
      sleep(Math.floor(Math.random() * (max - min) + min))
    }
}