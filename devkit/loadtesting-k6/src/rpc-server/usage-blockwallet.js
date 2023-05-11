import http from "k6/http";
import { check, sleep } from "k6";
import parseHarFile from "../../functions/parseHarFile.js";

const har = JSON.parse(
  open("../../rpc-calls/blockwallet-5min-mainnet-notxt.har")
);
const parsed = parseHarFile(har);

// Test configuration
export const options = {
  thresholds: {
    // Assert that 99% of requests finish within 3000ms.
    http_req_duration: ["p(99) < 3000"],
    http_req_failed: ["rate<0.1"],
  },
  // Ramp the number of virtual users up and down
  stages: [{ duration: "10m", target: 1000 }],
};

const URL =
  "http://localhost:3040/?exit-provider=https://primary.gnosis-chain.rpc.hoprtech.net";

// Simulated user behavior
export default function () {
  for (let i = 0; i < parsed.length; i++) {
    const parsedRequest = parsed[i];
    let res = http.post(URL, parsedRequest.body, parsedRequest.params);
    check(res, {
      "status was 200": (r) => r.status == 200,
      "verify resp": (r) => r.body.includes("jsonrpc"),
    });
    sleep(parsedRequest.waitTillNextCall);
  }
}
