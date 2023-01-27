import * as path from "path";
import levelup from "levelup";
import leveldown from "leveldown";
import { utils as ethersUtils } from "ethers";
import {
  Request,
  Response,
  type Message,
  Cache,
  Segment,
  hoprd,
  utils,
} from "@rpch/common";
import * as crypto from "@rpch/crypto-bridge/nodejs";
import * as exit from "./exit";
import * as identity from "./identity";
import { createLogger } from "./utils";
import PeerId from "peer-id";
import fetch from "node-fetch";

const log = createLogger();

const {
  RPCH_PASSWORD,
  RPCH_IDENTITY_DIR,
  RPCH_PRIVATE_KEY: RPCH_PRIVATE_KEY_STR,
  RPCH_DATA_DIR,
  HOPRD_API_ENDPOINT,
  HOPRD_API_TOKEN,
  RESPONSE_TIMEOUT: RESPONSE_TIMEOUT_STR = "10000",
} = process.env;

const DEFAULT_IDENTITY_DIR = path.join(process.cwd(), ".identity");
const DEFAULT_DATA_DIR = path.join(process.cwd(), "db");

/**
 * Fetch PeerIds which we have an outgoing channel with.
 * @returns list of PeerIds
 */
const fetchMyOutgoingPeers = async ({
  apiEndpoint,
  apiToken,
}: {
  apiEndpoint: string;
  apiToken: string | undefined;
}): Promise<string[]> => {
  const [url, headers] = utils.createApiUrl(
    "http",
    apiEndpoint,
    "/api/v2/channels",
    apiToken
  );

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (response.status === 200) {
    log.verbose("received addresses from HOPRd node");
    const result: {
      outgoing: {
        channelId: string;
        peerId: string;
        status: string;
        balance: string;
      }[];
    } = await response.json();
    return result.outgoing.map((channel) => channel.peerId);
  } else {
    log.error(
      "failed to fetch channels from HOPRd node",
      response.status,
      await response.text()
    );
    throw Error("failed to fetch channels from HOPRd node");
  }
};

export const start = async (ops: {
  exit: {
    sendRpcRequest: typeof exit.sendRpcRequest;
  };
  hoprd: {
    sendMessage: typeof hoprd.sendMessage;
    createMessageListener: typeof hoprd.createMessageListener;
    fetchPeerId: typeof hoprd.fetchPeerId;
  };
  privateKey?: Uint8Array;
  identityDir: string;
  password?: string;
  dataDir: string;
  apiEndpoint: string;
  apiToken?: string;
  timeout: number;
}): Promise<() => void> => {
  const onMessage = async (message: Message) => {
    try {
      // in the method, we are only expecting to receive
      // Requests, this means that the all messages are
      // prefixed by the entry node's peer id
      const [clientId] = utils.splitBodyToParts(message.body);

      // if this fails, then we most likely have received
      // a Response
      try {
        PeerId.createFromB58String(clientId);
      } catch {
        log.verbose("Ignoring Response as we are an exit node");
      }

      const lastRequestFromClient: bigint = await db
        .get(clientId)
        .then((v) => {
          return BigInt(v.toString());
        })
        .catch(() => BigInt(0));

      const rpchRequest = Request.fromMessage(
        crypto,
        message,
        myPeerId!,
        myIdentity,
        lastRequestFromClient,
        (clientId, counter) => {
          db.put(clientId, counter.toString());
        }
      );

      const response = await ops.exit.sendRpcRequest(
        rpchRequest.body,
        rpchRequest.provider
      );

      const rpchResponse = Response.createResponse(
        crypto,
        rpchRequest,
        response
      );
      for (const segment of rpchResponse.toMessage().toSegments()) {
        // TODO: remove once in Riga release
        // ALPHA intermediate selection
        const eligibleIntermediateNodes = peers.filter(
          (p) => p !== rpchRequest.entryNodeDestination
        );

        ops.hoprd.sendMessage({
          apiEndpoint: ops.apiEndpoint,
          apiToken: ops.apiToken,
          message: segment.toString(),
          destination: rpchRequest.entryNodeDestination,
          intermediate:
            eligibleIntermediateNodes.length > 0
              ? utils.randomlySelectFromArray(eligibleIntermediateNodes)
              : undefined,
        });
      }
    } catch (error) {
      log.error("Failed to respond with data", error);
    }
  };

  log.verbose("Initializing DB at", ops.dataDir);
  const db = levelup(leveldown(ops.dataDir));

  log.verbose("Fetching peer id", ops.dataDir);
  const myPeerId = await ops.hoprd
    .fetchPeerId({
      apiEndpoint: ops.apiEndpoint,
      apiToken: ops.apiToken,
    })
    .catch((error) => log.error(error));
  if (!myPeerId) throw Error("Could not find HOPRd's peer id");
  log.verbose("Fetched peer id", myPeerId);

  log.verbose("Get identity");
  const { publicKey, identity: myIdentity } = await identity.getIdentity({
    identityDir: ops.identityDir,
    password: ops.password,
    privateKey: ops.privateKey,
  });
  log.verbose("Got identity");
  log.normal("Running exit node with public key", publicKey);

  // TODO: remove once in Riga release
  // keep a list of peers updated
  let peers: string[] = [];
  const updatePeerList = async () => {
    try {
      const newPeers = await fetchMyOutgoingPeers({
        apiEndpoint: ops.apiEndpoint,
        apiToken: ops.apiToken,
      });
      if (newPeers.length > 0) {
        peers = newPeers;
      }
    } catch {}
  };
  await updatePeerList();

  const cache = new Cache(onMessage);
  const intervals: NodeJS.Timer[] = [];
  intervals.push(
    setInterval(() => {
      cache.removeExpired(ops.timeout);
    }, 1000)
  );
  intervals.push(
    setInterval(() => {
      updatePeerList();
    }, 60e3)
  );

  const stopMessageListening = await ops.hoprd.createMessageListener(
    ops.apiEndpoint,
    ops.apiToken || "",
    (message: string) => {
      try {
        const segment = Segment.fromString(message);
        cache.onSegment(segment);
      } catch (error) {
        log.normal(
          "Rejected received data from HOPRd: not a valid message",
          message
        );
      }
    }
  );

  return () => {
    for (const interval of intervals) {
      clearInterval(interval);
    }
    stopMessageListening();
  };
};

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  // Validate enviroment variables
  if (!RPCH_PRIVATE_KEY_STR && !RPCH_PASSWORD) {
    throw Error(
      "env variable 'RPCH_PRIVATE_KEY' and 'RPCH_PASSWORD' not found"
    );
  }
  if (!HOPRD_API_ENDPOINT) {
    throw Error("env variable 'HOPRD_API_ENDPOINT' not found");
  }
  if (!HOPRD_API_TOKEN) {
    throw Error("env variable 'HOPRD_API_TOKEN' not found");
  }

  const RESPONSE_TIMEOUT = Number(RESPONSE_TIMEOUT_STR);
  if (isNaN(RESPONSE_TIMEOUT)) {
    throw Error("env variable 'RESPONSE_TIMEOUT' not a number");
  }

  log.normal("Starting exit-node");

  start({
    exit,
    hoprd,
    privateKey: RPCH_PRIVATE_KEY_STR
      ? ethersUtils.arrayify(RPCH_PRIVATE_KEY_STR)
      : undefined,
    identityDir: RPCH_IDENTITY_DIR || DEFAULT_IDENTITY_DIR,
    password: RPCH_PASSWORD,
    dataDir: RPCH_DATA_DIR || DEFAULT_DATA_DIR,
    apiEndpoint: HOPRD_API_ENDPOINT,
    apiToken: HOPRD_API_TOKEN,
    timeout: RESPONSE_TIMEOUT,
  }).catch((error) => log.error(error));
}
