const {
  PORT: PORT_STR,
  DB_CONNECTION_URL,
  REVIEWER_INTERVAL_MS: REVIEWER_INTERVAL_MS_STR,
  REVIEWER_CONCURRENCY: REVIEWER_CONCURRENCY_STR,
} = process.env;

const REVIEWER_INTERVAL_MS = Number(REVIEWER_INTERVAL_MS_STR) || 30000;
const REVIEWER_CONCURRENCY = Number(REVIEWER_CONCURRENCY_STR) || 5;
const PORT = Number(PORT_STR) || 3050;
const METRIC_PREFIX = "availability_monitor";

export {
  DB_CONNECTION_URL,
  REVIEWER_INTERVAL_MS,
  REVIEWER_CONCURRENCY,
  PORT,
  METRIC_PREFIX,
};