import http from "k6/http";
import { check, sleep } from "k6";

import parseHarFile from "../functions/parseHarFile.js";

const blockwalleNoTxt = JSON.parse(open("../rpc-calls/blockwallet/blockwallet-5min-mainnet-notxt.har"));
const parsed = parseHarFile(blockwalleNoTxt);


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
    { duration: "10s", target: 10 },
  //  { duration: "5s", target: 1 },
  ],
};

const URL = "https://mainnet-node.blockwallet.io/";


// Simulated user behavior
export default function () {
  for(let i = 0; i < parsed.length; i++) {
    const parsedRequest = parsed[i];
    let res = http.post(URL, parsedRequest.body, parsedRequest.params);
    check(res, { "status was 200": (r) => r.status == 200 });
    //sleep(parsedRequest.waitTillNextCall);
    sleep(1);
  }
}