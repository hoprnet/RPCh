import * as entry from "./entry";
import * as hoprd from "./hoprd";
import * as exit from "./exit";
import { Manager } from "./manager";
import { createLogger } from "./utils";
import Request from "./request";
import Segment from "./segment";

const { log } = createLogger();

const {
  ENTRY_HOST,
  ENTRY_PORT: ENTRY_PORT_STR,
  HOPRD_API_ENDPOINT,
  HOPRD_API_TOKEN,
  RESPONSE_TIMEOUT_STR = "10000",
} = process.env;

// validate environment variables
if (!ENTRY_HOST) {
  throw Error("env variable 'ENTRY_HOST' not found");
}
if (!ENTRY_PORT_STR) {
  throw Error("env variable 'ENTRY_PORT' not found");
}
const ENTRY_PORT = Number(ENTRY_PORT_STR);
if (isNaN(ENTRY_PORT)) {
  throw Error("env variable 'ENTRY_PORT' not a number");
}
if (!HOPRD_API_ENDPOINT) {
  throw Error("env variable 'HOPRD_API_ENDPOINT' not found");
}
const RESPONSE_TIMEOUT = Number(RESPONSE_TIMEOUT_STR);
if (isNaN(RESPONSE_TIMEOUT)) {
  throw Error("env variable 'RESPONSE_TIMEOUT' not a number");
}

// this is periodically updated
let exitPeerIds: string[] = []

async function periodicallyFetchExitPeerIds(myPeerId: string, endpoint: string, token?: string) {
    const fun = async () => {
      const newExitPeerIds: string[] = await hoprd
      .fetchPeers(endpoint, token)
      .then((peers: string[]) => {
        return peers.filter((peer: string) => peer !== myPeerId);
    });
    log("found %i eligible exit peer ids", newExitPeerIds.length);
    exitPeerIds = newExitPeerIds
  }

  // call once initially
  await fun()
  // then every 20 seconds
  setInterval(fun, 20_000)
}

const start = async (ops: {
  entryHost: string;
  entryPort: number;
  apiEndpoint: string;
  apiToken?: string;
  timeout: number;
}): Promise<() => void> => {
  // TODO: retry and fail to start
  const myPeerId = await hoprd.fetchPeerId(ops.apiEndpoint, ops.apiToken);
  log("fetched PeerId", myPeerId);
  await periodicallyFetchExitPeerIds(myPeerId, ops.apiEndpoint, ops.apiToken)
  const manager = new Manager(
    ops.timeout,
    (segment, destination) => {
      return hoprd.sendMessage(
        ops.apiEndpoint,
        ops.apiToken,
        segment.toString(),
        destination
      );
    },
    (request, provider) => {
      return exit.sendRequest(request.body, provider);
    }
  );

  const getExitPeer = () => {
    if (exitPeerIds) {
      return exitPeerIds[Math.floor(Math.random() * exitPeerIds.length)]
    }
    return ""
  }

  const stopEntryServer = entry.createServer(
    ops.entryHost,
    ops.entryPort,
    (body, responseObj, exitProvider, exitPeerId) => {
      const request = Request.fromData(myPeerId, exitProvider, body);
      manager.createRequest(
        request,
        responseObj,
        exitPeerId || getExitPeer()
      );
    }
  );
  const stopHOPRdListener = hoprd.createListener(
    ops.apiEndpoint,
    ops.apiToken,
    (message) => {
      try {
        const segment = Segment.fromString(message);
        manager.onSegmentReceived(segment);
      } catch {
        log("rejected received data from HOPRd: not a valid segment", message);
      }
    }
  );

  const interval = setInterval(() => manager.removeExpired(), 1e3);

  return () => {
    clearInterval(interval);
    stopEntryServer();
    stopHOPRdListener();
  };
};

start({
  entryHost: ENTRY_HOST,
  entryPort: ENTRY_PORT,
  timeout: RESPONSE_TIMEOUT,
  apiEndpoint: HOPRD_API_ENDPOINT,
  apiToken: HOPRD_API_TOKEN,
});
