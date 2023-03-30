import * as path from "path";

const {
  RPCH_PASSWORD,
  RPCH_IDENTITY_DIR,
  RPCH_PRIVATE_KEY: RPCH_PRIVATE_KEY_STR,
  RPCH_DATA_DIR,
  HOPRD_API_ENDPOINT,
  HOPRD_API_TOKEN,
} = process.env;

const RESPONSE_TIMEOUT = process.env.RESPONSE_TIMEOUT
  ? Number(process.env.RESPONSE_TIMEOUT)
  : 10000;
const DEFAULT_IDENTITY_DIR = path.join(process.cwd(), ".identity");
const DEFAULT_DATA_DIR = path.join(process.cwd(), "db");
const ALGORITHM = "aes-192-cbc";

export {
  ALGORITHM,
  DEFAULT_DATA_DIR,
  DEFAULT_IDENTITY_DIR,
  HOPRD_API_ENDPOINT,
  HOPRD_API_TOKEN,
  RESPONSE_TIMEOUT,
  RPCH_DATA_DIR,
  RPCH_IDENTITY_DIR,
  RPCH_PASSWORD,
  RPCH_PRIVATE_KEY_STR,
};
