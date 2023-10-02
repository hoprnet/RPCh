import http from "k6/http";
import { check } from "k6";
import parseHarReq from "../../functions/parseHarReq.js";
import { eth_getCode } from "../../rpc-calls/eth_getCode.js";

const eth_getCode_parsed = parseHarReq(eth_getCode);
const URL =
  __ENV.RPC_SERVER_URL ||
  "http://localhost:8080/?exit-provider=https://gnosis-provider.rpch.tech";

// Simulated user behavior
export default function () {
  const res = http.post(
    URL,
    eth_getCode_parsed.body,
    eth_getCode_parsed.params
  );

  // Validate response status
  check(res, {
    "status was 200": (r) => r.status == 200,
    "verify resp": (r) =>
      r.body.includes("jsonrpc") && !r.body.includes("error"),
  });
}
