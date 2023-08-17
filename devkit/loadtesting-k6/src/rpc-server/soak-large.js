import large from "./large.js";

// Test configuration
export const options = {
  thresholds: {
    // Assert that 99% of requests finish within 10000ms.
    http_req_duration: ["p(99) < 10000"],
  },
  stages: [
    { duration: "20s", target: 20 }, // traffic ramp-up to low
    { duration: "2m", target: 20 }, // stay at low for long
    { duration: "20s", target: 0 }, // ramp-down to 0 users
  ],
};

export default large;

