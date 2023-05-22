import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    // burst_ten_in_one_sec: {
    //   executor: "constant-vus",
    //   vus: 10,
    //   duration: "1s",
    // },
    // burst_fifty_in_one_sec: {
    //   executor: "constant-vus",
    //   vus: 50,
    //   duration: "1s",
    //   startTime: "5s",
    // },
    burst_hundred_in_one_sec: {
      executor: "constant-vus",
      vus: 100,
      duration: "1s",
      startTime: "10s",
    },
    // burst_two_hundred_in_one_sec: {
    //   executor: "constant-vus",
    //   vus: 200,
    //   duration: "1s",
    //   startTime: "15s",
    // },
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
