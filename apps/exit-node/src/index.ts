import { WebSocket, MessageEvent, CloseEvent } from "isomorphic-ws";
import levelup from "levelup";
import leveldown from "leveldown";
import { utils as ethersUtils } from "ethers";
import * as crypto from "@rpch/crypto-for-nodejs";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as exit from "./exit";
import * as identity from "./identity";
import { createLogger } from "./utils";
import PeerId from "peer-id";
import * as Prometheus from "prom-client";
import { NodeAPI, Payload, ProviderAPI, Request, Response, Segment, SegmentCache } from "@rpch/sdk";
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

const requestExpirationCache: Map<
  string,
  ReturnType<typeof setTimeout>
> = new Map();

const counterStore: Map<string, bigint> = new Map();

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
  const intervals: ReturnType<typeof setInterval>[] = [];
  intervals.push(
    setInterval(() => {
      // cache.removeExpired(ops.timeout);
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

  const cache = SegmentCache.init();
  const socket = NodeAPI.connectWS({
    apiEndpoint: new URL(ops.apiEndpoint),
    apiToken: ops.apiToken,
  });
  if (!socket) {
    log.error("Failed opening websocket");
    process.exit(1);
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

    const segRes = Segment.fromString(msg.body);
    if (!segRes.success) {
      log.info("cannot create segment", segRes.error);
      return;
    }
    const segment = segRes.segment;
    const cacheRes = SegmentCache.incoming(cache, segment);
    switch (cacheRes.res) {
      case "complete":
        completeSegmentsEntry(cacheRes.entry!);
        break;
      case "error":
        log.error("error caching segment", cacheRes.reason);
        break;
      case "already-cached":
        log.info("already cached", Segment.prettyPrint(segment));
        break;
      case "inserted":
        log.verbose("inserted new segment", Segment.prettyPrint(segment));
        break;
    }
  };

  socket.on("error", (err: Error) => {
    log.error("ws error", err);
    // force restart
    process.exit(1);
  });

  socket.on("close", (evt: CloseEvent) => {
    log.error("ws close", evt);
    process.exit(1);
  });

  const completeSegmentsEntry = (entry: SegmentCache.Entry) => {
    const firstSeg = entry.segments.get(0)!;
    if (!firstSeg.body.startsWith("0x")) {
      log.info("message is not a response", firstSeg.requestId);
      return;
    }

    const msg = SegmentCache.toMessage(entry);
    const [entryId, hexData] = msg;
    const counter = counterStore.get(entryId) || BigInt(0);
    const res = Request.messageToReq({
      hexData,
      myPeerId,
      myIdentity,
      counter,
      crypto,
    });

    if (!Request.isSuccess(res)) {
      log.error("Error unboxing request:", res.error);
      return;
    }
    counterStore.set(entryId, res.counter);
    // TODO
    // inform dp of segments, use entry.count and res.req.clientId

    const { provider, req } = res.req;
    const resp = await ProviderAPI.fetchRPC(provider, req).catch((err: Error) => {
        log.error("Error doing rpc request", err, provider, req);
    });
    if (!resp) {
        return;
    }

    Response.respToMessage({
  crypto,
  entryId,
  requestId: firstSeg.requestId,
  resp,
  unboxSession: res.session});

      // counterRequestsToProvider.labels({ status: "complete" }).inc();
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
  });
}
