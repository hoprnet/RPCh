import * as path from "path";

const {
  DATA_DIR = path.join(process.cwd(), "db"),
  DISCOVERY_PLATFORM_API_ENDPOINT,
  CLIENT,
  FORCE_ENTRY_NODE_API_ENDPOINT,
  FORCE_ENTRY_NODE_API_TOKEN,
  FORCE_ENTRY_NODE_PEERID,
  FORCE_EXIT_NODE_PEERID,
  FORCE_EXIT_NODE_PUBKEY,
} = process.env;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3040;
const RESPONSE_TIMEOUT = process.env.RESPONSE_TIMEOUT
  ? Number(process.env.RESPONSE_TIMEOUT)
  : 10000;

// if any of the FORCE_ENTRY_* options are provided
// make sure they are all present
if (
  FORCE_ENTRY_NODE_API_ENDPOINT ||
  FORCE_ENTRY_NODE_API_TOKEN ||
  FORCE_ENTRY_NODE_PEERID
) {
  // check if some don't exist
  if (
    [
      FORCE_ENTRY_NODE_API_ENDPOINT,
      FORCE_ENTRY_NODE_API_TOKEN,
      FORCE_ENTRY_NODE_PEERID,
    ].some((str) => !str)
  ) {
    throw Error(`Incomplete options for FORCE_ENTRY_NODE:
      FORCE_ENTRY_NODE_API_ENDPOINT=${FORCE_ENTRY_NODE_API_ENDPOINT}
      FORCE_ENTRY_NODE_API_TOKEN=${FORCE_ENTRY_NODE_API_TOKEN}
      FORCE_ENTRY_NODE_PEERID=${FORCE_ENTRY_NODE_PEERID}`);
  }
}

// if any of the FORCE_EXIT_* options are provided
// make sure they are all present
if (FORCE_EXIT_NODE_PEERID || FORCE_EXIT_NODE_PUBKEY) {
  // check if some don't exist
  if ([FORCE_EXIT_NODE_PEERID, FORCE_EXIT_NODE_PUBKEY].some((str) => !str)) {
    throw Error(`Incomplete options for FORCE_ENTRY_NODE:
      FORCE_EXIT_NODE_PEERID=${FORCE_EXIT_NODE_PEERID}
      FORCE_EXIT_NODE_PUBKEY=${FORCE_EXIT_NODE_PUBKEY}`);
  }
}

export {
  DATA_DIR,
  PORT,
  RESPONSE_TIMEOUT,
  DISCOVERY_PLATFORM_API_ENDPOINT,
  CLIENT,
  FORCE_ENTRY_NODE_API_ENDPOINT,
  FORCE_ENTRY_NODE_API_TOKEN,
  FORCE_ENTRY_NODE_PEERID,
  FORCE_EXIT_NODE_PEERID,
  FORCE_EXIT_NODE_PUBKEY,
};
