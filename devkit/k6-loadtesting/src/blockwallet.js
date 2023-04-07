import http from "k6/http";
import { check, sleep } from "k6";
import parseHarReq from "../functions/parseHarReq.js";
import parseHarFile from "../functions/parseHarFile.js";

import { eth_getCode } from '../rpc-calls/blockwallet/eth_getCode.js'
//import { eth_call } from '../rpc-calls/blockwallet/eth_call.js'



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
    { duration: "5s", target: 50 },
    { duration: "5s", target: 500 },
  ],
};

const URL = "https://mainnet-node.blockwallet.io/";

const parsed = parseHarReq(eth_getCode)

// Simulated user behavior
export default function () {
    let res = http.post(URL, parsed.body, parsed.params);

    // Validate response status
    check(res, { "status was 200": (r) => r.status == 200 });
    sleep(1);
}