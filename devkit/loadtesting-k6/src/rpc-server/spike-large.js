import large from "./large.js";

// Test configuration
export const options = {
  thresholds: {
    // Assert that 99% of requests finish within 10000ms.
    http_req_duration: ["p(99) < 10000"],
  },
  // Ramp the number of virtual users up and down
  stages: [
    { duration: "30s", target: 100 }, // fast ramp-up to a high point
    // No plateau
    { duration: "10", target: 0 }, // quick ramp-down to 0 users
  ],
};

export default large;
