import http from "k6/http";
import { check, sleep } from "k6";
import parseHarReq from "../functions/parseHarReq.js";
import parseHarFile from "../functions/parseHarFile.js";

import { eth_getCode } from '../rpc-calls/blockwallet/eth_getCode.js'
import { eth_call } from '../rpc-calls/blockwallet/eth_call.js'



// Install K6 on test machine 
// https://k6.io/docs/get-started/installation/


// Test configuration
export const options = {
  thresholds: {
    // Assert that 99% of requests finish within 3000ms.
    http_req_duration: ["p(99) < 3000"],
  },
  // Ramp the number of virtual users up and down
  stages: [
    { duration: "5s", target: 1 },
    { duration: "20s", target: 10 },
    { duration: "100s", target: 100 },
  ],
};

const URL = "http://localhost:3040/?exit-provider=https://primary.gnosis-chain.rpc.hoprtech.net";

const eth_getCode_parsed = parseHarReq(eth_getCode);
const eth_call_parsed = parseHarReq(eth_call);

// Simulated user behavior
export default function () {
    let res = http.post(URL, eth_getCode_parsed.body, eth_getCode_parsed.params);

    // Validate response status
    check(res, { "status was 200": (r) => r.status == 200 });
    sleep(1);

    let res2 = http.post(URL, eth_call_parsed.body, eth_call_parsed.params);

    // Validate response status
    check(res2, { "status was 200": (r) => r.status == 200 });
}