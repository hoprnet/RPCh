const {
  // Api endpoint used for completing funding requests of registered nodes
  FUNDING_SERVICE_URL,
  // API endpoint used to interact with availability monitor
  AVAILABILITY_MONITOR_URL,
  // Database connection url
  DB_CONNECTION_URL,
  // Secret for custom authentication
  SECRET,
} = process.env;

// Skips commitment check making all fresh nodes go to ready
const SKIP_CHECK_COMMITMENT = process.env.SKIP_CHECK_COMMITMENT === "true";

const RUNNING_IN_SANDBOX = process.env.RUNNING_IN_SANDBOX === "true";

// Unit amount of quotas a request costs
const BASE_QUOTA = process.env.BASE_QUOTA
  ? BigInt(process.env.BASE_QUOTA)
  : BigInt(1);

// Port that server will listen for requests
const PORT = process.env.PORT ? Number(process.env.PORT) : 3020;

// Minimal amount of balance a account must have to show commitment
const BALANCE_THRESHOLD = process.env.BALANCE_THRESHOLD
  ? Number(process.env.BALANCE_THRESHOLD)
  : 1;

// Minimal amount of open channels a account must have to show commitment
const CHANNELS_THRESHOLD = process.env.CHANNELS_THRESHOLD
  ? Number(process.env.CHANNELS_THRESHOLD)
  : 1;

// Subgraph endpoint used to query node commitment
const SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/hoprnet/hopr-channels";

// Base amount of reward that a node will receive after completing a request
const BASE_EXTRA = 1;

// Max amount of connections app will have with db
const MAX_DB_CONNECTIONS = 18;

// Used to create
const AMOUNT_OF_RANDOM_WORDS_FOR_TRIAL_ID = 5;

const METRIC_PREFIX = "discovery_platform";

// payment mode when quota is paid by trial
const TRIAL_PAYMENT_MODE = "trial";

// client id that will pay for quotas in trial mode
const TRIAL_CLIENT_ID = "trial";
const QUEUE_CONCURRENCY_LIMIT = 5;

export {
  PORT,
  FUNDING_SERVICE_URL,
  DB_CONNECTION_URL,
  BALANCE_THRESHOLD,
  CHANNELS_THRESHOLD,
  BASE_QUOTA,
  BASE_EXTRA,
  SUBGRAPH_URL,
  SKIP_CHECK_COMMITMENT,
  MAX_DB_CONNECTIONS,
  AMOUNT_OF_RANDOM_WORDS_FOR_TRIAL_ID,
  METRIC_PREFIX,
  TRIAL_CLIENT_ID,
  TRIAL_PAYMENT_MODE,
  QUEUE_CONCURRENCY_LIMIT,
  SECRET,
  AVAILABILITY_MONITOR_URL,
  RUNNING_IN_SANDBOX,
};
