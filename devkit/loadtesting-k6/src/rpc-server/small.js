import http from "k6/http";
import { check } from "k6";

const params = {
  headers: {
    accept: "application/json",
    "content-type": "application/json",
  },
};

let count = 0;
const jsonBody = {
  jsonrpc: "2.0",
  method: "eth_getBlockTransactionCountByNumber",
  params: ["latest"],
};

const URL =
  __ENV.RPC_SERVER_URL ||
  "http://localhost:8080/?exit-provider=https://primary.gnosis-chain.rpc.hoprtech.net";

// Simulated user behavior
export default function () {
  const id = count++;
  jsonBody.id = id;
  const body = JSON.stringify(jsonBody);
  const res = http.post(URL, body, params);

  // Validate response status
  check(res, {
    "status was 200": (r) => r.status == 200,
    "verify resp": (r) =>
      r.body.includes("jsonrpc") && !r.body.includes("error"),
  });
}
