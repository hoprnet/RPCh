const {
  // Api endpoint used for completing funding requests of registered nodes
  FUNDING_SERVICE_URL,
  // Access token used to connect to hoprd entry node
  HOPRD_ACCESS_TOKEN,
  // Database connection url
  DB_CONNECTION_URL,
} = process.env;

// Skips commitment check making all fresh nodes go to ready
const SKIP_CHECK_COMMITMENT = process.env.SKIP_CHECK_COMMITMENT === "true";

// Unit amount of quotas a request costs
const BASE_QUOTA = Number(process.env.BASE_QUOTA) ?? 1;

// Port that server will listen for requests
const PORT = Number(process.env.PORT) ?? 3020;

// Minimal amount of balance a account must have to show commitment
const BALANCE_THRESHOLD = Number(process.env.BALANCE_THRESHOLD) ?? 1;

// Minimal amount of open channels a account must have to show commitment
const CHANNELS_THRESHOLD = Number(process.env.CHANNELS_THRESHOLD) ?? 1;

// Subgraph endpoint used to query node commitment
const SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/hoprnet/hopr-channels";

// Base amount of reward that a node will receive after completing a request
const BASE_EXTRA = 1;

export {
  PORT,
  FUNDING_SERVICE_URL,
  HOPRD_ACCESS_TOKEN,
  DB_CONNECTION_URL,
  BALANCE_THRESHOLD,
  CHANNELS_THRESHOLD,
  BASE_QUOTA,
  BASE_EXTRA,
  SUBGRAPH_URL,
  SKIP_CHECK_COMMITMENT,
};
