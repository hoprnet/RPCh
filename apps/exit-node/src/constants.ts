import * as path from "path";

const RESPONSE_TIMEOUT = 10000;
const DEFAULT_IDENTITY_FILE = path.join(process.cwd(), ".identity");
const DEFAULT_DATA_DIR = path.join(process.cwd(), "db");
const ALGORITHM = "aes-192-cbc";
const METRIC_PREFIX = "exit_node";
const PUSHGATEWAY_ENDPOINT = "https://pushgateway.rpch.tech";
const OPT_IN_METRICS = false;
const SEND_METRICS_INTERVAL = 60e3;

export {
  ALGORITHM,
  DEFAULT_DATA_DIR,
  DEFAULT_IDENTITY_FILE,
  RESPONSE_TIMEOUT,
  METRIC_PREFIX,
  PUSHGATEWAY_ENDPOINT,
  OPT_IN_METRICS,
  SEND_METRICS_INTERVAL,
};
