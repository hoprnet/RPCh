import { WebSocket, MessageEvent } from "isomorphic-ws";
import levelup from "levelup";
import leveldown from "leveldown";
import { utils as ethersUtils } from "ethers";
import {
  Request,
  Response,
  type Message,
  Cache,
  Segment,
  utils,
} from "@rpch/common";
import * as crypto from "@rpch/crypto-for-nodejs";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as exit from "./exit";
import * as identity from "./identity";
import { createLogger } from "./utils";
import PeerId from "peer-id";
import * as Prometheus from "prom-client";
import {
  DEFAULT_DATA_DIR,
  DEFAULT_IDENTITY_FILE,
  HOPRD_API_ENDPOINT,
  HOPRD_API_TOKEN,
  METRIC_PREFIX,
  OPT_IN_METRICS,
  PUSHGATEWAY_ENDPOINT,
  RESPONSE_TIMEOUT,
  RPCH_DATA_DIR,
  RPCH_IDENTITY_FILE,
  RPCH_PASSWORD,
  RPCH_PRIVATE_KEY_STR,
  SEND_METRICS_INTERVAL,
} from "./constants";

const log = createLogger();

export const start = async (ops: {
  exit: {
    sendRpcRequest: typeof exit.sendRpcRequest;
  };
  privateKey?: Uint8Array;
  identityFile: string;
  password?: string;
  dataDir: string;
  apiEndpoint: string;
  apiToken?: string;
  timeout: number;
  pushgatewayEndpoint: string;
  optInMetrics: boolean;
  sendMetricsInterval: number;
}): Promise<() => void> => {
  const metricManager = new MetricManager(
    Prometheus,
    Prometheus.register,
    METRIC_PREFIX
  );

  const gateway = new Prometheus.Pushgateway(ops.pushgatewayEndpoint);

  // Metrics
  const counterRequests = metricManager.createCounter(
    "counter_received_request",
    "amount of requests exit node has processed",
    { labelNames: ["status"] }
  );

  const counterRequestsToProvider = metricManager.createCounter(
    "counter_provider_request",
    "amount of requests exit node has sent to provider",
    { labelNames: ["status"] }
  );

  const headers = {
    "x-auth-token": ops.apiToken!,
    "Content-Type": "application/json",
  };
  const sendUrl = new URL("/api/v3/messages", ops.apiEndpoint);
  const onMessage = async (message: Message, tag?: number) => {
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
      const rpchRequest = await Request.fromMessage(
        crypto,
        message,
        myPeerId!,
        myIdentity,
        lastRequestFromClient,
        (clientId, counter) => {
          return db.put(clientId, counter.toString());
        }
      );

      const response = await ops.exit.sendRpcRequest(
        rpchRequest.body,
        rpchRequest.provider
      );

      counterRequestsToProvider.labels({ status: "complete" }).inc();

      const rpchResponse = await Response.createResponse(
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
        const body = JSON.stringify({
          tag,
          body: segment.toString(),
          peerId: rpchRequest.entryNodeDestination,
          path: [],
        });

        fetch(sendUrl, { headers, method: "POST", body })
          .then((res) => res.json())
          .then((json) => log.verbose("sendMessage", JSON.stringify(json)))
          .catch((error) => log.error("Failed to send segment", error));
      }
    } catch (error) {
      log.error("Failed to respond with data", error);
      counterRequestsToProvider.labels({ status: "error" }).inc();
    }
  };

  log.verbose("Initializing DB at", ops.dataDir);
  const db = levelup(leveldown(ops.dataDir));

  log.verbose("Fetching peer id", ops.dataDir);
  const addressUrl = new URL("/api/v3/account/addresses", ops.apiEndpoint);
  // @ts-ignore
  const { hopr: myPeerId } = await fetch(addressUrl, { headers })
    .then((r) => r.json())
    .catch((error) => log.error(error));
  if (!myPeerId) throw Error("Could not find HOPRd's peer id");
  log.verbose("Fetched peer id", myPeerId);

  log.verbose("Get identity");
  const { publicKey, identity: myIdentity } = await identity.getIdentity({
    identityFile: ops.identityFile,
    password: ops.password,
    privateKey: ops.privateKey,
  });
  log.verbose("Got identity");
  log.normal("Running exit node with public key", publicKey);

  const cache = new Cache(onMessage, () => {
    counterRequests.labels({ status: "error" }).inc();
  });

  const intervals: ReturnType<typeof setInterval>[] = [];
  intervals.push(
    setInterval(() => {
      cache.removeExpired(ops.timeout);
    }, 1000)
  );

  if (ops.optInMetrics) {
    const pushMetrics = setInterval(() => {
      gateway
        .pushAdd({ jobName: publicKey + "_exit_node_metrics" })
        .catch((e) => {
          log.error("failed to push metrics", e);
        });
    }, ops.sendMetricsInterval);

    intervals.push(pushMetrics);
  }

  const wsURL = new URL(ops.apiEndpoint.toString());
  wsURL.protocol = ops.apiEndpoint.startsWith("https:") ? "wss:" : "ws:";
  wsURL.pathname = "/api/v3/messages/websocket";
  wsURL.search = `?apiToken=${ops.apiToken!}`;
  const socket = new WebSocket(wsURL);
  if (!socket) {
    log.error("failed opening websocket on", wsURL);
    throw new Error("no ws connection");
  }
  socket.onmessage = (evt: MessageEvent) => {
    const body = evt.data.toString();

    let msg: { type: string; tag: number; body: string };
    try {
      msg = JSON.parse(body);
    } catch (error) {
      log.error("Error decoding message:", error);
      return;
    }

    // message received is an acknowledgement of a
    // message we have send, we can safely ignore this
    if (msg.type.startsWith("ack:")) {
      return;
    }

    try {
      const segment = Segment.fromString(msg.body);
      cache.onSegment(segment, msg.tag);
    } catch (error) {
      log.verbose(
        "rejected received data from HOPRd: not a valid segment",
        msg
      );
    }
  };

  socket.on("error", (err) => {
    log.error("ws error", err);
    // force restart
    throw err;
  });

  socket.on("close", (err) => {
    log.error("ws close", err);
    // force restart
    throw err;
  });

  return () => {
    for (const interval of intervals) {
      clearInterval(interval);
    }
    socket.close();
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
    privateKey: RPCH_PRIVATE_KEY_STR
      ? ethersUtils.arrayify(RPCH_PRIVATE_KEY_STR)
      : undefined,
    identityFile: RPCH_IDENTITY_FILE || DEFAULT_IDENTITY_FILE,
    password: RPCH_PASSWORD,
    dataDir: RPCH_DATA_DIR || DEFAULT_DATA_DIR,
    apiEndpoint: HOPRD_API_ENDPOINT,
    apiToken: HOPRD_API_TOKEN,
    timeout: RESPONSE_TIMEOUT,
    optInMetrics: OPT_IN_METRICS,
    pushgatewayEndpoint: PUSHGATEWAY_ENDPOINT,
    sendMetricsInterval: SEND_METRICS_INTERVAL,
  }).catch((error) => log.error(error));
}
