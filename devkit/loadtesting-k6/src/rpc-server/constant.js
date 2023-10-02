import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    constant_one_per_sec: {
      executor: "constant-arrival-rate",
      rate: 1,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 10,
    },
    constant_ten_per_sec: {
      executor: "constant-arrival-rate",
      rate: 10,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 100,
      startTime: "30s",
    },
    constant_hundred_per_sec: {
      executor: "constant-arrival-rate",
      rate: 100,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 1000,
      startTime: "60s",
    },
    constant_two_hundred_per_sec: {
      executor: "constant-arrival-rate",
      rate: 200,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 2000,
      startTime: "90s",
    },
  },
};

// Simulated user behavior
export default function () {
  const URL =
    __ENV.RPC_SERVER_URL ||
    "http://localhost:8080/?exit-provider=https://gnosis-provider.rpch.tech";
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
