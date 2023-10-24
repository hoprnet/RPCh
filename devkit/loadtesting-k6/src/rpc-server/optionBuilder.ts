import { Options } from "k6/options";
import { OptionTypes, TestOption } from "./types.js";

export function getOption(
  optName: OptionTypes
): Options | undefined {
  switch (TestOption[optName]) {
    case TestOption.SMOKE:
      return smokeOptions;
    case TestOption.SOAK:
      return soakOptions;
    case TestOption.SPIKE:
      return spikeOptions;
    case TestOption.STRESS:
      return stressOptions;
    case TestOption.LOAD:
      return loadOptions;
    case TestOption.BURST:
      return burstOptions;
    case TestOption.CONSTANT:
      return constantOptions;
    case TestOption.LONG:
      return longOptions;
    default:
      console.log("cannot match request");
      return;
  }
}

// Test configuration, see https://docs.k6.io/docs/options
const smokeOptions: Options = {
  vus: 3, // Key for Smoke test. Keep it at 2, 3, max 5 VUs
  duration: '1m', // This can be shorter or just a few iterations
};
// Test configuration, see https://docs.k6.io/docs/options
const soakOptions: Options = {
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

const spikeOptions: Options = {
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

const stressOptions: Options = {
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

const loadOptions: Options = {
  thresholds: {
    // Assert that 99% of requests finish within 3000ms.
    http_req_duration: ["p(99) < 3000"],
    http_req_failed: ["rate<0.1"],
  },
  stages: [
    { duration: "5m", target: 20 },
    { duration: "30m", target: 20 },
    { duration: "5m", target: 0 },
  ],
};

const burstOptions: Options = {
  scenarios: {
    burst_ten_in_one_sec: {
      executor: "constant-vus",
      vus: 10,
      duration: "1s",
    },
    burst_fifty_in_one_sec: {
      executor: "constant-vus",
      vus: 50,
      duration: "1s",
      startTime: "5s",
    },
    burst_hundred_in_one_sec: {
      executor: "constant-vus",
      vus: 100,
      duration: "1s",
      startTime: "10s",
    },
    burst_two_hundred_in_one_sec: {
      executor: "constant-vus",
      vus: 200,
      duration: "1s",
      startTime: "15s",
    },
  },
};

const constantOptions: Options = {
  scenarios: {
    constant_one_per_sec: {
      executor: "constant-arrival-rate",
      rate: 1,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 10,
    },
    constant_ten_per_sec: {
      executor: "constant-arrival-rate",
      rate: 10,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 100,
      startTime: "30s",
    },
    constant_hundred_per_sec: {
      executor: "constant-arrival-rate",
      rate: 100,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 1000,
      startTime: "60s",
    },
    constant_two_hundred_per_sec: {
      executor: "constant-arrival-rate",
      rate: 200,
      timeUnit: "1s",
      duration: "10s",
      preAllocatedVUs: 2000,
      startTime: "90s",
    },
  },
};

const longOptions: Options = {
  scenarios: {
    long_six_hundred_in_one_min: {
      executor: "constant-arrival-rate",
      rate: 10,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 600,
    },
    long_twelve_hundred_in_one_min: {
      executor: "constant-arrival-rate",
      rate: 20,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 1200,
      startTime: "90s",
    },
  },
};
