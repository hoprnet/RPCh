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
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as exit from "./exit";
import * as identity from "./identity";
import { createLogger } from "./utils";
import PeerId from "peer-id";
import * as Prometheus from "prom-client";
import {
  DEFAULT_DATA_DIR,
  DEFAULT_IDENTITY_DIR,
  HOPRD_API_ENDPOINT,
  HOPRD_API_TOKEN,
  METRIC_PREFIX,
  OPT_IN_METRICS,
  PUSHGATEWAY_ENDPOINT,
  RESPONSE_TIMEOUT,
  RPCH_DATA_DIR,
  RPCH_IDENTITY_DIR,
  RPCH_PASSWORD,
  RPCH_PRIVATE_KEY_STR,
} from "./constants";

const log = createLogger();

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
  const metricManager = new MetricManager(
    Prometheus,
    Prometheus.register,
    METRIC_PREFIX
  );

  const gateway = new Prometheus.Pushgateway(PUSHGATEWAY_ENDPOINT);

  // Metrics
  const counterRequests = metricManager.createCounter(
    "counter_received_request",
    "amount of requests exit node has processed",
    { labelNames: ["status"] }
  );

  const counterRequestsToProvider = metricManager.createCounter(
    "counter_sent_request",
    "amount of requests exit node has sent to provider",
    { labelNames: ["status"] }
  );

  const onMessage = async (message: Message) => {
    try {
      log.verbose("Received message", message.id, message.body);
      counterRequests.labels({ status: "complete" }).inc();
      // in the method, we are only expecting to receive
      // Requests, this means that the all messages are
      // prefixed by the entry node's peer id
      const [clientId] = utils.splitBodyToParts(message.body);

      // if this fails, then we most likely have received
      // a Response
      try {
        PeerId.createFromB58String(clientId);
      } catch {
        log.verbose("Ignoring Response as we are an exit node", message.id);
        return;
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

      counterRequestsToProvider.labels({ status: "complete" }).inc();

      const rpchResponse = Response.createResponse(
        crypto,
        rpchRequest,
        response
      );
      log.verbose(
        "Created response",
        rpchResponse.id,
        rpchResponse.toMessage().body
      );

      for (const segment of rpchResponse.toMessage().toSegments()) {
        ops.hoprd
          .sendMessage({
            apiEndpoint: ops.apiEndpoint,
            apiToken: ops.apiToken,
            message: segment.toString(),
            destination: rpchRequest.entryNodeDestination,
            path: [],
          })
          .catch((error) => {
            log.error("Failed to send segment", error);
          });
      }
    } catch (error) {
      log.error("Failed to respond with data", error);
      counterRequestsToProvider.labels({ status: "error" }).inc();
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

  const cache = new Cache(onMessage, () => {
    counterRequests.labels({ status: "error" }).inc();
  });

  const intervals: NodeJS.Timer[] = [];
  intervals.push(
    setInterval(() => {
      cache.removeExpired(ops.timeout);
    }, 1000)
  );

  if (OPT_IN_METRICS) {
    const pushMetrics = setInterval(() => {
      gateway.pushAdd({ jobName: publicKey + "_exit_node_metrics" });
    }, 60e3);

    intervals.push(pushMetrics);
  }

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
