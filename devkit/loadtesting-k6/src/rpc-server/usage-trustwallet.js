import http from "k6/http";
import { check, sleep } from "k6";
import parseHarFile from "../../functions/parseHarFile.js";

const har = JSON.parse(open("../../rpc-calls/trustwallet-5min-gnosis-txt.har"));
const parsed = parseHarFile(har);

// Test configuration
export const options = {
  thresholds: {
    // Assert that 99% of requests finish within 3000ms.
    http_req_duration: ["p(99) < 3000"],
  },
  // Ramp the number of virtual users up and down
  stages: [{ duration: "5m", target: 10000 }],
};

// Simulated user behavior
export default function () {
  const URL =
    __ENV.RPC_SERVER_URL ||
    "http://localhost:8080/?exit-provider=https://primary.gnosis-chain.rpc.hoprtech.net";

  for (let i = 0; i < parsed.length; i++) {
    const parsedRequest = parsed[i];
    let res = http.post(URL, parsedRequest.body, parsedRequest.params);
    check(res, {
      "status was 200": (r) => r.status == 200,
      "verify resp": (r) =>
        r.body.includes("jsonrpc") && !r.body.includes("error"),
    });
    sleep(parsedRequest.waitTillNextCall);
  }
}
