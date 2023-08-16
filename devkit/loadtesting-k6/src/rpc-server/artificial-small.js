import http from "k6/http";
import { check } from "k6";

// Test configuration
export const options = {
  thresholds: {
    // Assert that 99% of requests finish within 3000ms.
    http_req_duration: ["p(99) < 3000"],
  },
  // Ramp the number of virtual users up and down
  stages: [
    { duration: "5s", target: 1 },
    // { duration: "15s", target: 100 },
    // { duration: "60s", target: 5000 },
  ],
};

const params = {
  headers: {
    accept: "application/json",
    "content-type": "application/json",
  },
};

const body = JSON.stringify({
  jsonrpc: "2.0",
  method: "eth_getBlockTransactionCountByNumber",
  params: ["latest"],
});

const URL =
  __ENV.RPC_SERVER_URL ||
  "http://localhost:8080/?exit-provider=https://primary.gnosis-chain.rpc.hoprtech.net";

// Simulated user behavior
export default function () {
  const res = http.post(URL, body, params);

  // Validate response status
  check(res, {
    "status was 200": (r) => r.status == 200,
    "verify resp": (r) =>
      r.body.includes("jsonrpc") && !r.body.includes("error"),
  });
}
