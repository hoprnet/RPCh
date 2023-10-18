import * as path from "path";
import { WebSocket, MessageEvent, CloseEvent } from "isomorphic-ws";
import { utils } from "ethers";

import * as Identity from "./identity";
import { createLogger } from "./utils";
import {
  DPapi,
  NodeAPI,
  Payload,
  ProviderAPI,
  Request,
  Response,
  Segment,
  SegmentCache,
  Utils,
} from "@rpch/sdk";

const log = createLogger();

const SocketReconnectTimeout = 1e3; // 1sek
const RequestPurgeTimeout = 10e3; // 10sek

type State = {
  socket?: WebSocket;
  publicKey: string;
  privateKey: Uint8Array;
  peerId: string;
  cache: SegmentCache.Cache;
  deleteTimer: Map<number, ReturnType<typeof setTimeout>>; // deletion timer of requests in segment cache
  counterStore: Map<string, Date>;
};

type Ops = {
  privateKey?: Uint8Array;
  identityFile: string;
  password?: string;
  apiEndpoint: URL;
  accessToken: string;
  discoveryPlatformEndpoint: string;
  nodeAccessToken: string;
  forceZeroHop: boolean;
};

async function start(ops: Ops) {
  const state = await setup(ops);
  if (!state) {
    log.error("Fatal error initializing exit code");
    process.exit(1);
  }
  setupSocket(state, ops);
}

async function setup(ops: Ops): Promise<State> {
  const resId = await Identity.getIdentity({
    identityFile: ops.identityFile,
    password: ops.password,
    privateKey: ops.privateKey,
  }).catch((err: Error) => {
    log.error("Error accessing identity", err);
  });
  if (!resId) {
    return Promise.reject();
  }

  log.verbose("Got identity", resId.publicKey);

  const resPeerId = await NodeAPI.accountAddresses(ops).catch((err: Error) => {
    log.error("Error fetching account addresses", err);
  });
  if (!resPeerId) {
    return Promise.reject();
  }

  const { hopr: peerId } = resPeerId;
  log.verbose("Fetched peer id %s[%s]", Utils.shortPeerId(peerId), peerId);

  const cache = SegmentCache.init();
  const deleteTimer = new Map();
  const counterStore = new Map();

  const logOpts = {
    identityFile: ops.identityFile,
    apiEndpoint: ops.apiEndpoint,
    discoveryPlatformEndpoint: ops.discoveryPlatformEndpoint,
    forceZeroHop: ops.forceZeroHop,
  };
  log.verbose("started exit-node with", JSON.stringify(logOpts));

  return {
    cache,
    counterStore,
    deleteTimer,
    privateKey: utils.arrayify(resId.privateKey),
    peerId,
    publicKey: resId.publicKey,
  };
}

function setupSocket(state: State, ops: Ops) {
  const socket = NodeAPI.connectWS(ops);
  if (!socket) {
    log.error("Failed opening websocket");
    process.exit(3);
  }

  socket.onmessage = onMessage(state, ops);

  socket.on("error", (err: Error) => {
    log.error("ws error", err);
    // attempt reconnect
    setTimeout(() => setupSocket(state, ops), SocketReconnectTimeout);
  });

  socket.on("close", (evt: CloseEvent) => {
    log.error("ws close", evt);
    // attempt reconnect
    setTimeout(() => setupSocket(state, ops), SocketReconnectTimeout);
  });

  socket.on("open", () => {
    log.verbose("opened websocket listener");
  });

  state.socket = socket;
}

function onMessage(state: State, ops: Ops) {
  return function (evt: MessageEvent) {
    const raw = evt.data.toString();
    const msg: { type: string; tag: number; body: string } = JSON.parse(raw);

    if (msg.type !== "message") {
      return;
    }

    const segRes = Segment.fromMessage(msg.body);
    if (!segRes.success) {
      log.info("cannot create segment", segRes.error);
      return;
    }

    const segment = segRes.segment;
    const cacheRes = SegmentCache.incoming(state.cache, segment);
    switch (cacheRes.res) {
      case "complete":
        log.verbose("completion segment", Segment.prettyPrint(segment));
        clearTimeout(state.deleteTimer.get(segment.requestId));
        completeSegmentsEntry(state, ops, cacheRes.entry!, msg.tag);
        break;
      case "error":
        log.error("error caching segment", cacheRes.reason);
        break;
      case "already-cached":
        log.info("already cached", Segment.prettyPrint(segment));
        break;
      case "added-to-request":
        log.verbose(
          "inserted new segment to existing request",
          Segment.prettyPrint(segment)
        );
        break;
      case "inserted-new":
        log.verbose("inserted new first segment", Segment.prettyPrint(segment));
        state.deleteTimer.set(
          segment.requestId,
          setTimeout(() => {
            log.info("purging incomplete request", segment.requestId);
            SegmentCache.remove(state.cache, segment.requestId);
          }, RequestPurgeTimeout)
        );
        break;
    }
  };
}

async function completeSegmentsEntry(
  state: State,
  ops: Ops,
  cacheEntry: SegmentCache.Entry,
  tag: number
) {
  const firstSeg = cacheEntry.segments.get(0)!;
  if (!firstSeg.body.startsWith("0x")) {
    log.info("message is not a request", firstSeg.requestId);
    return;
  }
  const msg = SegmentCache.toMessage(cacheEntry);
  const msgParts = msg.split(",");
  if (msgParts.length !== 2) {
    log.info("Invalid message parts", msgParts);
    return;
  }

  const [hexEntryId, hexData] = msgParts;
  const entryIdData = utils.arrayify(hexEntryId);
  const entryPeerId = utils.toUtf8String(entryIdData);
  const reqData = utils.arrayify(hexData);
  const counter = state.counterStore.get(entryPeerId) || new Date(0);
  const resReq = Request.messageToReq({
    message: reqData,
    counter,
    exitPeerId: state.peerId,
    exitPrivateKey: state.privateKey,
  });
  switch (resReq.res) {
    case "error":
      log.error("Error unboxing request", resReq.reason);
      return;
    case "counterfail": {
      const now = new Date();
      log.info(
        "Counterfail unboxing request - lowerbound %i upperbound %i",
        counter,
        now
      );
      // counterfail response
      const resResp = Response.respToMessage({
        entryPeerId,
        respPayload: { type: "counterfail", min: counter, max: now },
        unboxSession: resReq.session,
      });
      if (!Response.msgSuccess(resResp)) {
        log.error("Error boxing counterfail resp", resResp.error);
        return;
      }
      sendResponse(
        { ops, cacheEntry, tag, reqPayload: resReq.req, entryPeerId },
        resResp.hexData
      );
      return;
    }
    case "success": {
      state.counterStore.set(entryPeerId, resReq.counter);

      // do RPC request
      const { provider, req, headers } = resReq.req;
      const resp = await ProviderAPI.fetchRPC(provider, req, headers).catch(
        (err: Error) => {
          log.error(
            "Error RPC requesting %s with %s: %s",
            provider,
            JSON.stringify(req),
            JSON.stringify(err)
          );
          // rpc critical fail response
          const resResp = Response.respToMessage({
            entryPeerId,
            respPayload: { type: "error", reason: JSON.stringify(err) },
            unboxSession: resReq.session,
          });
          if (!Response.msgSuccess(resResp)) {
            log.error("Error boxing generic error resp", resResp.error);
            return;
          }
          sendResponse(
            { ops, cacheEntry, tag, reqPayload: resReq.req, entryPeerId },
            resResp.hexData
          );
        }
      );
      if (!resp) {
        return;
      }

      // http fail response
      if ("status" in resp) {
        const resResp = Response.respToMessage({
          entryPeerId,
          respPayload: {
            type: "httperror",
            status: resp.status,
            text: resp.message,
          },
          unboxSession: resReq.session,
        });
        if (!Response.msgSuccess(resResp)) {
          log.error("Error boxing http error resp", resResp.error);
          return;
        }
        sendResponse(
          { ops, cacheEntry, tag, reqPayload: resReq.req, entryPeerId },
          resResp.hexData
        );
        return;
      }

      // success Response
      const resResp = Response.respToMessage({
        entryPeerId,
        respPayload: { type: "resp", resp },
        unboxSession: resReq.session,
      });
      if (!Response.msgSuccess(resResp)) {
        log.error("Error boxing response", resResp.error);
        return;
      }
      sendResponse(
        { ops, entryPeerId, cacheEntry, tag, reqPayload: resReq.req },
        resResp.hexData
      );
      return;
    }
  }
}

function sendResponse(
  {
    ops,
    entryPeerId,
    cacheEntry,
    tag,
    reqPayload,
  }: {
    ops: Ops;
    entryPeerId: string;
    tag: number;
    cacheEntry: SegmentCache.Entry;
    reqPayload: Payload.ReqPayload;
  },
  resp: string
) {
  const requestId = cacheEntry.segments.get(0)!.requestId;
  const segments = Segment.toSegments(requestId, resp);

  log.verbose(
    "Returning message to %s, tag: %s, requestId: %i",
    Utils.shortPeerId(entryPeerId),
    tag,
    requestId
  );

  // queue segment sending for all of them
  segments.forEach((seg: Segment.Segment) => {
    setTimeout(() => {
      NodeAPI.sendMessage(ops, {
        recipient: entryPeerId,
        tag,
        message: Segment.toMessage(seg),
      }).catch((err: Error) => {
        log.error("error sending segment", Segment.prettyPrint(seg), err);
      });
    });
  });

  // inform DP non blocking
  setTimeout(() => {
    const lastReqSeg = cacheEntry.segments.get(cacheEntry.count - 1)!;
    const quotaRequest: DPapi.QuotaParams = {
      clientId: reqPayload.clientId,
      rpcMethod: reqPayload.req.method,
      segmentCount: cacheEntry.count,
      lastSegmentLength: lastReqSeg.body.length,
      type: "request",
    };

    const lastRespSeg = segments[segments.length - 1]!;
    const quotaResponse: DPapi.QuotaParams = {
      clientId: reqPayload.clientId,
      rpcMethod: reqPayload.req.method,
      segmentCount: segments.length,
      lastSegmentLength: lastRespSeg.body.length,
      type: "response",
    };

    DPapi.fetchQuota(ops, quotaRequest).catch((ex) => {
      log.error("Error recording request quota", ex);
    });
    DPapi.fetchQuota(ops, quotaResponse).catch((ex) => {
      log.error("Error recording response quota", ex);
    });
  }, segments.length);
}

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  if (!process.env.RPCH_PRIVATE_KEY && !process.env.RPCH_PASSWORD) {
    throw new Error("Missing 'RPCH_PRIVATE_KEY' or 'RPCH_PASSWORD' env var.");
  }

  if (!process.env.HOPRD_API_ENDPOINT) {
    throw new Error("Missing 'HOPRD_API_ENDPOINT' env var.");
  }
  if (!process.env.HOPRD_API_TOKEN) {
    throw new Error("Missing 'HOPRD_API_TOKEN' env var.");
  }
  if (!process.env.DISCOVERY_PLATFORM_API_ENDPOINT) {
    throw new Error("Missing 'DISCOVERY_PLATFORM_API_ENDPOINT' env var.");
  }
  if (!process.env.DISCOVERY_PLATFORM_ACCESS_TOKEN) {
    throw new Error("Missing 'DISCOVERY_PLATFORM_ACCESS_TOKEN' env var.");
  }
  const identityFile =
    process.env.RPCH_IDENTITY_FILE || path.join(process.cwd(), ".identity");
  const privateKey = process.env.RPCH_PRIVATE_KEY
    ? utils.arrayify(process.env.RPCH_PRIVATE_KEY)
    : undefined;

  const forceZeroHop = !!process.env.RPCH_FORCE_ZERO_HOP;

  start({
    privateKey,
    identityFile,
    forceZeroHop,
    password: process.env.RPCH_PASSWORD,
    apiEndpoint: new URL(process.env.HOPRD_API_ENDPOINT),
    accessToken: process.env.HOPRD_API_TOKEN,
    discoveryPlatformEndpoint: process.env.DISCOVERY_PLATFORM_API_ENDPOINT,
    nodeAccessToken: process.env.DISCOVERY_PLATFORM_ACCESS_TOKEN,
  });
}
