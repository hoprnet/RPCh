const {
  PORT: PORT_STR,
  DB_CONNECTION_URL,
  REVIEWER_INTERVAL_MS: REVIEWER_INTERVAL_MS_STR,
  REVIEWER_CONCURRENCY: REVIEWER_CONCURRENCY_STR,
  MIN_AMOUNT_PEERS: MIN_AMOUNT_PEERS_STR,
  MIN_AMOUNT_CHANNELS: MIN_AMOUNT_CHANNELS_STR,
  HOPRD_REQS_TIMEOUT: HOPRD_REQS_TIMEOUT_STR,
  CHECK_TIMEOUT: CHECK_TIMEOUT_STR,
} = process.env;

/** how often to queue new batch of reviews */
const REVIEWER_INTERVAL_MS = Number(REVIEWER_INTERVAL_MS_STR) || 30000;
/** how many nodes to review in parallel */
const REVIEWER_CONCURRENCY = Number(REVIEWER_CONCURRENCY_STR) || 5;
/** minimum amount of peers required for check 'hoprdPeers' */
const MIN_AMOUNT_PEERS = Number(MIN_AMOUNT_PEERS_STR) || 200;
/** minimum amount of open outgoing channels required for check 'hoprdOpenOutgoingChannels' */
const MIN_AMOUNT_CHANNELS = Number(MIN_AMOUNT_CHANNELS_STR) || 1;
/** timeout for requests made to the HOPRd nodes */
const HOPRD_REQS_TIMEOUT = Number(HOPRD_REQS_TIMEOUT_STR) || 10000;
/** timeout for a single check */
const CHECK_TIMEOUT = Number(CHECK_TIMEOUT_STR) || 15000;
const PORT = Number(PORT_STR) || 3050;
const METRIC_PREFIX = "availability_monitor";

export {
  DB_CONNECTION_URL,
  REVIEWER_INTERVAL_MS,
  REVIEWER_CONCURRENCY,
  MIN_AMOUNT_PEERS,
  MIN_AMOUNT_CHANNELS,
  HOPRD_REQS_TIMEOUT,
  CHECK_TIMEOUT,
  PORT,
  METRIC_PREFIX,
};
