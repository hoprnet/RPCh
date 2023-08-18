import small from "./small.js";

// Test configuration
export const options = {
  thresholds: {
    // Assert that 99% of requests finish within 10000ms.
    http_req_duration: ["p(99) < 10000"],
  },
  stages: [
    { duration: "30s", target: 50 }, // traffic ramp-up
    { duration: "1m", target: 50 }, // stay high at plateau
    { duration: "30s", target: 0 }, // ramp-down to 0 users
  ],
};

export default small;
