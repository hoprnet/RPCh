import http from "k6/http";
import { check, sleep } from "k6";

// Test configuration
export const options = {
  thresholds: {
    // Assert that 99% of requests finish within 10000ms.
    http_req_duration: ["p(99) < 10000"],
  },
  stages: [
    { duration: "20s", target: 200 }, // traffic ramp-up to low
    { duration: "30m", target: 200 }, // stay at low for long
    { duration: "20s", target: 0 }, // ramp-down to 0 users
  ],
};

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
  sleep(1);

  // Validate response status
  check(res, {
    "status was 200": (r) => r.status == 200,
    "verify resp": (r) =>
      r.body.includes("jsonrpc") && !r.body.includes("error"),
  });
}
