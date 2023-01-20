const {
  // Port that server will listen for requests
  PORT = 3020,
  // Api endpoint used for completing funding requests of registered nodes
  FUNDING_SERVICE_URL,
  // Access token used to connect to hoprd entry node
  HOPRD_ACCESS_TOKEN,
  // Database connection url
  DB_CONNECTION_URL,
  // Minimal amount of balance a account must have to show commitment
  BALANCE_THRESHOLD = 1,
  // Minimal amount of open channels a account must have to show commitment
  CHANNELS_THRESHOLD = 1,
  // Unit amount of quotas a request costs
  BASE_QUOTA = 1,
} = process.env;

// Skips commitment check making all fresh nodes go to ready
const SKIP_CHECK_COMMITMENT =
  Boolean(process.env.SKIP_CHECK_COMMITMENT) ?? false;

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
