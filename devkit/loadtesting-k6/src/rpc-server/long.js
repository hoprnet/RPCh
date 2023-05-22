import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    long_six_hundred_in_one_min: {
      executor: "constant-arrival-rate",
      rate: 10,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 600,
    },
    long_twelve_hundred_in_one_min: {
      executor: "constant-arrival-rate",
      rate: 20,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 1200,
      startTime: "90s",
    },
  },
};

// Simulated user behavior
export default function () {
  const URL =
    __ENV.RPC_SERVER_URL ||
    "http://localhost:8080/?exit-provider=https://primary.gnosis-chain.rpc.hoprtech.net";
  const RPC_REQUEST =
    __ENV.RPC_REQUEST ||
    `{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":83}`;

  let res = http.post(URL, RPC_REQUEST);

  // Validate response status
  check(res, {
    "status was 200": (r) => r.status == 200,
    "verify resp": (r) =>
      r.body.includes("jsonrpc") && !r.body.includes("error"),
  });
}
