import * as path from "path";

const {
  DATA_DIR = path.join(process.cwd(), "db"),
  DISCOVERY_PLATFORM_API_ENDPOINT,
  CLIENT,
} = process.env;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3040;
const RESPONSE_TIMEOUT = process.env.RESPONSE_TIMEOUT
  ? Number(process.env.RESPONSE_TIMEOUT)
  : 10000;

export {
  DATA_DIR,
  PORT,
  RESPONSE_TIMEOUT,
  DISCOVERY_PLATFORM_API_ENDPOINT,
  CLIENT,
};
