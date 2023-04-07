import * as path from "path";
require('dotenv').config({path:path.join(process.cwd(), './.env.local')})

const {
  DISCOVERY_PLATFORM_API_ENDPOINT,
  CLIENT,
} = process.env;

const DATA_DIR = process.env.DATA_DIR ? process.env.DATA_DIR : path.join(process.cwd(), "db");
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
