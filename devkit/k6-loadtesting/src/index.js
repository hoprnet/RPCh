import http from "k6/http";
import { check, sleep } from "k6";

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
    { duration: "30s", target: 15 },
    { duration: "1m", target: 15 },
    { duration: "20s", target: 0 },
  ],
};

// Simulated user behavior
export default function () {
  let res = http.get("http://localhost:8080/?exit-provider=https://primary.gnosis-chain.rpc.hoprtech.net");

  
  // Validate response status
  check(res, { "status was 200": (r) => r.status == 200 });
  sleep(1);
}