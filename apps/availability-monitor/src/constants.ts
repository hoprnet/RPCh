const { DB_CONNECTION_URL } = process.env;

/** how often to queue new batch of reviews */
const REVIEWER_INTERVAL_MS = 30000;
/** how many nodes to review in parallel */
const REVIEWER_CONCURRENCY = 5;
/** minimum amount of peers required for check 'hoprdPeers' */
const MIN_AMOUNT_PEERS = 200;
/** minimum amount of open outgoing channels required for check 'hoprdOpenOutgoingChannels' */
const MIN_AMOUNT_CHANNELS = 1;
/** timeout for requests made to the HOPRd nodes */
const HOPRD_REQS_TIMEOUT = 10000;
/** timeout for a single check */
const CHECK_TIMEOUT = 15000;
const METRIC_PREFIX = "availability_monitor";

export {
  DB_CONNECTION_URL,
  REVIEWER_INTERVAL_MS,
  REVIEWER_CONCURRENCY,
  MIN_AMOUNT_PEERS,
  MIN_AMOUNT_CHANNELS,
  HOPRD_REQS_TIMEOUT,
  CHECK_TIMEOUT,
  METRIC_PREFIX,
};
