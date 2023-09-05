import type * as RPChCrypto from "@rpch/crypto";
import "@hoprnet/hopr-sdk";
import { utils as etherUtils } from "ethers";

import { createLogger } from "./utils";
import * as NodeAPI from "./node-api";
import NodesCollector from "./nodes-collector";
import type { EntryNode } from "./entry-node";
import * as Request from "./request";
import * as RequestCache from "./request-cache";
import * as Segment from "./segment";
import * as SegmentCache from "./segment-cache";
import * as Response from "./response";

export type RPCrequest = {
  readonly jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any[] | object;
};

export type RPCresponse = {
  readonly jsonrpc: "2.0";
  id?: string | number | null;
};

export type RPCresult = RPCresponse & {
  result: any;
};

export type RPCerror = RPCresponse & {
  error: {
    code: number;
    message: string;
    data?: any;
  };
};

/**
 * HOPR SDK options provide global defaults.
 * There are sane defaults for all of them.
 * Most of those values can be overridden per request.
 * See **RequestOps** for specifics.
 * See **defaultOps** for defaults.
 *
 * @param discoveryPlatformEndpoint discovery platform API endpoint
 * @param timeout - timeout for receiving responses
 * @param provider - target rpc provider
 * @param mevProtectionProvider - target MEV Protection provider RPC
 * @param enableMEV - whether to enable MEV protection. This will send the transactions to the MEV protection RPC
 */
export type Ops = {
  discoveryPlatformEndpoint?: string;
  timeout?: number;
  provider?: string;
  mevProtectionProvider?: string;
  enableMEV?: boolean;
};

/**
 * Global defaults.
 * See **Ops** for details.
 **/
const defaultOps: Ops = {
  discoveryPlatformEndpoint: "https://discovery.rpch.tech",
  timeout: 30e3,
  provider: "https://primary.gnosis-chain.rpc.hoprtech.net",
  mevProtectionProvider: "https://rpc.propellerheads.xyz/eth",
  enableMEV: true,
};

/**
 * Overridable parameters per request.
 * See **Ops** for details.
 */
export type RequestOps = {
  timeout?: number;
  provider?: string;
  mevProtectionProvider?: string;
  enableMEV?: boolean;
};

const MAX_REQUEST_SEGMENTS = 10;
const log = createLogger();

// message tag - more like port since we tag all our messages the same
const ApplicationTag = Math.floor(Math.random() * 0xffff);

/**
 * Send traffic through the RPCh network
 */
export default class SDK {
  private readonly requestCache: RequestCache.Cache;
  private readonly segmentCache: SegmentCache.Cache;
  private readonly redoRequests: Set<number> = new Set();
  private readonly counterStore: Map<string, bigint> = new Map();
  private readonly nodesColl: NodesCollector;
  private readonly ops: Ops;

  /**
   * Construct an SDK instance enabling RPCh requests.
   * @param cliendId your unique string used to identify how many requests your client/wallet pushes through the network
   * @param crypto crypto instantiation for RPCh, use `@rpch/crypto-for-nodejs` or `@rpch/crypto-for-web`
   * @param ops, see **Ops**
   **/
  constructor(
    private readonly clientId: string,
    private readonly crypto: typeof RPChCrypto,
    ops: Ops = {}
  ) {
    this.ops = {
      ...defaultOps,
      ...ops,
    };

    this.crypto = crypto;
    this.crypto.set_panic_hook();
    this.requestCache = RequestCache.init();
    this.segmentCache = SegmentCache.init();
    this.nodesColl = new NodesCollector(
      this.ops.discoveryPlatformEndpoint!,
      this.clientId,
      ApplicationTag,
      this.onMessages
    );
  }

  /**
   * Stop listeners and free acquired resources.
   */
  public destruct = () => {
    this.nodesColl.destruct();
    for (const [rId] of this.requestCache) {
      RequestCache.remove(this.requestCache, rId);
      SegmentCache.remove(this.segmentCache, rId);
    }
  };

  /**
   * Resolves true when node pairs are awailable.
   * If no timeout specified, global timeout is used.
   */
  public async isReady(timeout?: number): Promise<boolean> {
    const timeout_ = timeout ? timeout : this.ops.timeout!;
    return this.nodesColl.ready(timeout_).then((_) => true);
  }

  /**
   * Send an **RPCrequest** via RPCh.
   * See **RequestOps** for overridable options.
   */
  public async send(
    req: RPCrequest,
    ops?: RequestOps
  ): Promise<RPCresult | RPCerror> {
    const reqOps = {
      ...this.ops,
      ...ops,
    };
    return new Promise(async (resolve, reject) => {
      // gather entry - exit node pair
      const res = await this.nodesColl
        .requestNodePair(reqOps.timeout!)
        .catch((err) => {
          log.error("Error finding node pair", err);
          return reject(`Could not find node pair in ${reqOps.timeout} ms`);
        });
      if (!res) {
        return reject(`Unexpected code flow - should never be here`);
      }

      // decide which provider to use
      const provider =
        reqOps.enableMEV! && req.method === "eth_sendRawTransaction"
          ? reqOps.mevProtectionProvider!
          : reqOps.provider!;

      // create request
      const { entryNode, exitNode } = res;
      const id = RequestCache.generateId(this.requestCache);
      const request = Request.create(
        this.crypto,
        id,
        provider,
        req,
        entryNode.id,
        exitNode.id,
        this.crypto!.Identity.load_identity(
          etherUtils.arrayify(exitNode.pubKey)
        )
      );

      // split request to segments
      const segments = Request.toSegments(request);
      if (segments.length > MAX_REQUEST_SEGMENTS) {
        log.error(
          "Request exceeds maximum amount of segments with %s segments",
          segments.length
        );
        return reject("Request exceeds maximum size of 3830b");
      }

      // set request expiration timer
      const timer = setTimeout(() => {
        log.error("request expired", request.id);
        this.removeRequest(request);
        return reject("request timed out");
      }, reqOps.timeout);

      // track request
      RequestCache.add(this.requestCache, request, resolve, reject, timer);
      this.nodesColl.requestStarted(request);

      // send request to hoprd
      log.info("sending request %i", request.id);

      // queue segment sending for all of them
      segments.forEach((s) =>
        setTimeout(() => {
          this.nodesColl.segmentStarted(request, s);
          this.sendSegment(request, s, entryNode, reject);
        })
      );
    });
  }

  private sendSegment = (
    request: Request.Request,
    segment: Segment.Segment,
    entryNode: EntryNode,
    reject: (reason: string) => void
  ) => {
    const bef = Date.now();
    NodeAPI.sendMessage(
      {
        apiEndpoint: entryNode.apiEndpoint,
        accessToken: entryNode.accessToken,
      },
      {
        recipient: request.exitId,
        tag: ApplicationTag,
        message: Segment.toMessage(segment),
      }
    )
      .then((_json) => {
        const dur = Date.now() - bef;
        this.nodesColl.segmentSucceeded(request, segment, dur);
      })
      .catch((error) => {
        log.error("error sending segment", Segment.prettyPrint(segment), error);
        this.nodesColl.segmentFailed(request, segment);
        return reject("Sending message failed");
        // this.resendRequest(request, endFrame, resolve, reject);
      });
  };

  // private resendRequest(
  //   origReq: Request.Request,
  //   endFrame: number,
  //   resolve: (res: RPCresult | RPCerror) => void,
  //   reject: (reason: string) => void
  // ) {
  //   if (this.redoRequests.has(origReq.id)) {
  //     log.verbose("ignoring already triggered resend", origReq.id);
  //     return;
  //   }

  //   this.removeRequest(origReq);
  //   const fallback = this.nodesColl.fallbackNodePair;
  //   if (!fallback) {
  //     log.info("no fallback for resending request available");
  //     return reject("no fallback node pair to retry sending request");
  //   }

  //   this.redoRequests.add(origReq.id);
  //   if (fallback.entryNode.id === origReq.entryId) {
  //     log.info(
  //       "fallback entry node same as original entry node - still trying"
  //     );
  //   }
  //   if (fallback.exitNode.id === origReq.exitId) {
  //     log.info("fallback exit node same as original exit node - still trying");
  //   }

  //   // generate new request
  //   const id = RequestCache.generateId(this.requestCache);
  //   const request = Request.fromOriginal(
  //     this.crypto,
  //     id,
  //     origReq,
  //     fallback.entryNode.id,
  //     fallback.exitNode.id,
  //     this.crypto!.Identity.load_identity(
  //       etherUtils.arrayify(fallback.exitNode.pubKey)
  //     )
  //   );

  //   // set request expiration timer
  //   const timer = setTimeout(() => {
  //     log.error(
  //       "resend request expired",
  //       request.id,
  //       "for original",
  //       origReq.id
  //     );
  //     this.removeRequest(request);
  //     return reject("request timed out");
  //   }, endFrame - Date.now());

  //   // track request
  //   RequestCache.add(this.requestCache, request, resolve, reject, timer);
  //   this.nodesColl.requestStarted(request);

  //   // split request to segments
  //   const segments = Request.toSegments(request);
  //   if (segments.length > MAX_REQUEST_SEGMENTS) {
  //     log.error(
  //       "Resend request exceeds maximum amount of segments with %s segments - should never happen",
  //       segments.length,
  //       "new:",
  //       request.id,
  //       "original:",
  //       request.id
  //     );
  //     this.removeRequest(request);
  //     return reject("Request exceeds maximum size of 3830b");
  //   }

  //   // send request to hoprd
  //   log.info("resending request %i", request.id, "for original", origReq.id);

  //   // send segments sequentially
  //   segments.forEach((s) =>
  //     setTimeout(() =>
  //       this.resendSegment(s, request, fallback.entryNode, reject)
  //     )
  //   );
  // }

  // private resendSegment = (
  //   segment: Segment.Segment,
  //   request: Request.Request,
  //   entryNode: EntryNode,
  //   reject: (reason: string) => void
  // ) => {
  //   NodeAPI.sendMessage(
  //     {
  //       apiEndpoint: entryNode.apiEndpoint,
  //       accessToken: entryNode.accessToken,
  //       recipient: request.exitId,
  //       tag: ApplicationTag,
  //     },
  //     Segment.toMessage(segment)
  //   )
  //     .then((json) => {
  //       log.verbose(
  //         "resent segment",
  //         Segment.prettyPrint(segment),
  //         json,
  //         "original:",
  //         request.originalId
  //       );
  //     })
  //     .catch((error) => {
  //       log.error(
  //         "error resending segment",
  //         Segment.prettyPrint(segment),
  //         error,
  //         "original:",
  //         request.originalId
  //       );
  //       this.removeRequest(request);
  //       reject("Sending message failed");
  //     });
  // };

  // handle incoming messages
  private onMessages = (messages: NodeAPI.Message[]) => {
    messages.forEach(({ body }) => {
      const segRes = Segment.fromString(body);
      if (!segRes.success) {
        log.info("cannot create segment", segRes.error);
        return;
      }
      const segment = segRes.segment;
      if (!this.requestCache.has(segment.requestId)) {
        log.info(
          "dropping unrelated request segment",
          Segment.prettyPrint(segment)
        );
        return;
      }

      const cacheRes = SegmentCache.incoming(this.segmentCache, segment);
      switch (cacheRes.res) {
        case "complete":
          this.completeSegmentsEntry(cacheRes.entry!);
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
    });
  };

  private async completeSegmentsEntry(entry: SegmentCache.Entry) {
    const firstSeg = entry.segments.get(0)!;
    if (!firstSeg.body.startsWith("0x")) {
      log.info("message is not a response", firstSeg.requestId);
      return;
    }

    const request = this.requestCache.get(firstSeg.requestId)!;
    RequestCache.remove(this.requestCache, request.id);

    const message = SegmentCache.toMessage(entry);
    const counter = this.counterStore.get(request.exitId) || BigInt(0);

    const res = Response.messageToBody(message, request, counter, this.crypto);
    if (res.success) {
      this.counterStore.set(request.exitId, res.counter);
      const responseTime = Date.now() - request.createdAt;
      log.verbose(
        "response time for request %s: %s ms, counter %i",
        request.id,
        responseTime,
        counter
      );
      this.nodesColl.requestSucceeded(request, responseTime);

      log.verbose(
        "responded to %s with %s",
        JSON.stringify(request.req),
        res.body
      );
      try {
        const json = JSON.parse(res.body);
        return request.resolve(json);
      } catch (err) {
        log.error("Parsing response JSON failed with:", err);
        return request.reject("Unable to parse response");
      }
    } else {
      log.error("Error extracting message", res.error);
      this.nodesColl.requestFailed(request);
      return request.reject("Unable to process response");
    }
  }

  private removeRequest(request: Request.Request) {
    this.nodesColl.requestFailed(request);
    RequestCache.remove(this.requestCache, request.id);
    SegmentCache.remove(this.segmentCache, request.id);
    if (request.originalId) {
      this.redoRequests.delete(request.originalId);
    }
  }
}
