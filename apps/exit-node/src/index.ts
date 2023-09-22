import * as crypto from "@rpch/crypto-for-nodejs";
import * as path from "path";
import { WebSocket, MessageEvent, CloseEvent } from "isomorphic-ws";
import { utils } from "ethers";

import * as Identity from "./identity";
import { createLogger } from "./utils";
import {
  NodeAPI,
  ProviderAPI,
  Request,
  Response,
  Segment,
  SegmentCache,
} from "@rpch/sdk";

const log = createLogger();

const SocketReconnectTimeout = 1e3; // 1sek
const RequestPurgeTimeout = 10e3; // 10sek

type State = {
  socket?: WebSocket;
  publicKey: string;
  identity: crypto.Identity;
  peerId: string;
  cache: SegmentCache.Cache;
  deleteTimer: Map<number, ReturnType<typeof setTimeout>>; // deletion timer of requests in segment cache
  counterStore: Map<string, bigint>;
};

type Ops = {
  privateKey?: Uint8Array;
  identityFile: string;
  password?: string;
  apiEndpoint: URL;
  accessToken: string;
  dpApiEndpoint: URL;
  dpAccessToken: string;
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
  log.verbose("Fetched peer id", peerId);

  const cache = SegmentCache.init();
  const deleteTimer = new Map();
  const counterStore = new Map();

  return {
    cache,
    counterStore,
    deleteTimer,
    identity: resId.identity,
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
  entry: SegmentCache.Entry,
  tag: number
) {
  const firstSeg = entry.segments.get(0)!;
  if (!firstSeg.body.startsWith("0x")) {
    log.info("message is not a request", firstSeg.requestId);
    return;
  }
  const msg = SegmentCache.toMessage(entry);
  const msgParts = msg.split(",");
  if (msgParts.length !== 2) {
    log.info("Invalid message parts", msgParts);
    return;
  }

  const [hexEntryId, hexData] = msgParts;
  const entryIdData = utils.arrayify(hexEntryId);
  const entryId = utils.toUtf8String(entryIdData);
  const reqData = utils.arrayify(hexData);
  const counter = state.counterStore.get(entryId) || BigInt(0);
  const resReq = Request.messageToReq({
    body: reqData,
    exitId: state.peerId,
    exitNodeWriteIdentity: state.identity,
    counter,
    crypto,
  });
  if (!Request.reqSuccess(resReq)) {
    log.error("Error unboxing request:", resReq.error);
    return;
  }

  state.counterStore.set(entryId, resReq.counter);

  // TODO
  // inform DP of segments, use entry.count and res.req.clientId

  const { provider, req } = resReq.req;
  const resp = await ProviderAPI.fetchRPC(provider, req).catch((err: Error) => {
    log.error("Error doing rpc request", err, provider, req);
  });
  if (!resp) {
    return;
  }

  const resResp = Response.respToMessage({
    crypto,
    entryId,
    resp,
    unboxSession: resReq.session,
  });

  if (!Response.msgSuccess(resResp)) {
    log.error("Error boxing response", resResp.error);
    return;
  }

  const segments = Segment.toSegments(firstSeg.requestId, resResp.hexData);

  // TODO
  // inform DP of segments, count and client id

  // queue segment sending for all of them
  segments.forEach((seg: Segment.Segment) => {
    setTimeout(() => {
      NodeAPI.sendMessage(ops, {
        recipient: entryId,
        tag,
        message: Segment.toMessage(seg),
      }).catch((err: Error) => {
        log.error("error sending segment", Segment.prettyPrint(seg), err);
      });
    });
  });
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

  start({
    privateKey,
    identityFile,
    password: process.env.RPCH_PASSWORD,
    apiEndpoint: new URL(process.env.HOPRD_API_ENDPOINT),
    accessToken: process.env.HOPRD_API_TOKEN,
    dpApiEndpoint: new URL(process.env.DISCOVERY_PLATFORM_API_ENDPOINT),
    dpAccessToken: process.env.DISCOVERY_PLATFORM_ACCESS_TOKEN,
  });
}
