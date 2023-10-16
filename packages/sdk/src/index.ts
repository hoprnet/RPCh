import "@hoprnet/hopr-sdk";
import { utils as etherUtils } from "ethers";

import * as JRPC from "./jrpc";
import * as NodeAPI from "./node-api";
import * as ProviderAPI from "./provider-api";
import * as Request from "./request";
import * as RequestCache from "./request-cache";
import * as Response from "./response";
import * as Segment from "./segment";
import * as SegmentCache from "./segment-cache";
import * as utils from "./utils";
import NodesCollector from "./nodes-collector";
import type { EntryNode } from "./entry-node";

export * as DPapi from "./dp-api";
export * as JRPC from "./jrpc";
export * as NodeAPI from "./node-api";
export * as Payload from "./payload";
export * as ProviderAPI from "./provider-api";
export * as Request from "./request";
export * as Response from "./response";
export * as Segment from "./segment";
export * as SegmentCache from "./segment-cache";

/**
 * HOPR SDK options provides global parameter values.
 * Two of them can be overridden on a per request base.
 * None of the parameters need to be set as the SDK provides defaults for all of them.
 * See **RequestOps** for specifics.
 * See **defaultOps** for defaults.
 *
 * @param discoveryPlatformEndpoint discovery platform API endpoint
 * @param timeout - timeout for receiving responses
 * @param provider - target rpc provider
 * @param disableMevProtection - disable provider replacement on transaction requests
 * @param mevProtectionProvider - target MEV Protection provider RPC,
 *                                will send transactions through this provider
 * @param mevKickbackAddress - provide this URL for receiving kickback share to a different address than the tx origin
 * @param forceZeroHop - disable routing protection
 */
export type Ops = {
  readonly discoveryPlatformEndpoint?: string;
  readonly timeout?: number;
  readonly provider?: string;
  readonly disableMevProtection?: boolean;
  readonly mevProtectionProvider?: string;
  readonly mevKickbackAddress?: string;
  readonly forceZeroHop?: boolean;
};

/**
 * Overridable parameters per request.
 * See **Ops** for details.
 */
export type RequestOps = {
  readonly timeout?: number;
  readonly provider?: string;
};

const RPC_PROPELLORHEADS = "https://rpc.propellerheads.xyz/eth";

/**
 * Global defaults.
 * See **Ops** for details.
 **/
const defaultOps: Ops = {
  discoveryPlatformEndpoint: "https://discovery.rpch.tech",
  timeout: 10e3,
  provider: "https://gnosis-provider.rpch.tech",
  disableMevProtection: false,
  mevProtectionProvider: RPC_PROPELLORHEADS,
  forceZeroHop: false,
};

const MAX_REQUEST_SEGMENTS = 20;
const log = utils.createLogger();

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
  private readonly chainIds: Map<string, number> = new Map();

  /**
   * Construct an SDK instance enabling RPCh requests.
   * @param cliendId your unique string used to identify how many requests your client/wallet pushes through the network
   * @param crypto crypto instantiation for RPCh, use `@rpch/crypto-for-nodejs` or `@rpch/crypto-for-web`
   * @param ops, see **Ops**
   **/
  constructor(private readonly clientId: string, ops: Ops = {}) {
    this.ops = this.sdkOps(ops);
    this.requestCache = RequestCache.init();
    this.segmentCache = SegmentCache.init();
    this.nodesColl = new NodesCollector(
      this.ops.discoveryPlatformEndpoint as string,
      this.clientId,
      !!this.ops.forceZeroHop,
      ApplicationTag,
      this.onMessages
    );
    this.fetchChainId(this.ops.provider as string);
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
    const t = timeout || (this.ops.timeout as number);
    return this.nodesColl.ready(t).then((_) => true);
  }

  /**
   * Send an **RPCrequest** via RPCh.
   * See **RequestOps** for overridable options.
   */
  public async send(
    req: JRPC.Request,
    ops?: RequestOps
  ): Promise<JRPC.Response> {
    const reqOps = this.requestOps(ops);
    this.populateChainIds(ops?.provider);
    return new Promise(async (resolve, reject) => {
      // sanity check provider url
      if (!utils.isValidURL(reqOps.provider as string)) {
        return reject("Cannot parse provider URL");
      }
      // sanity check mev protection provider url, if it is set
      if (!!this.ops.mevProtectionProvider) {
        if (!utils.isValidURL(this.ops.mevProtectionProvider)) {
          return reject("Cannot parse mevProtectionProvider URL");
        }
      }

      // gather entry - exit node pair
      const res = await this.nodesColl
        .requestNodePair(reqOps.timeout as number)
        .catch((err) => {
          log.error("Error finding node pair", err);
          return reject(`Could not find node pair in ${reqOps.timeout} ms`);
        });
      if (!res) {
        return reject(`Unexpected code flow - should never be here`);
      }

      const provider = this.determineProvider(
        reqOps as { provider: string },
        req
      );

      const headers = this.determineHeaders(
        provider,
        this.ops.mevKickbackAddress
      );

      // create request
      const { entryNode, exitNode } = res;
      const id = RequestCache.generateId(this.requestCache);
      const request = Request.create({
        crypto: this.crypto,
        id,
        provider,
        req,
        clientId: this.clientId,
        entryId: entryNode.id,
        exitId: exitNode.id,
        exitNodeReadIdentity: this.crypto!.Identity.load_identity(
          etherUtils.arrayify(exitNode.pubKey)
        ),
        headers,
      });

      // split request to segments
      const segments = Request.toSegments(request);
      if (segments.length > MAX_REQUEST_SEGMENTS) {
        log.error(
          "Request exceeds maximum amount of segments with %s segments",
          segments.length
        );
        return reject("Request exceeds maximum size of 7660b");
      }

      // set request expiration timer
      const timer = setTimeout(() => {
        log.error("request expired", request.id);
        this.removeRequest(request);
        return reject("request timed out");
      }, reqOps.timeout);

      // track request
      const entry = RequestCache.add(
        this.requestCache,
        request,
        resolve,
        reject,
        timer
      );
      this.nodesColl.requestStarted(request);

      // send request to hoprd
      log.info("sending request %i", request.id);

      // queue segment sending for all of them
      segments.forEach((s) =>
        setTimeout(() => {
          this.nodesColl.segmentStarted(request, s);
          this.sendSegment(request, s, entryNode, entry);
        })
      );
    });
  }

  private sendSegment = (
    request: Request.Request,
    segment: Segment.Segment,
    entryNode: EntryNode,
    cacheEntry: RequestCache.Entry
  ) => {
    const bef = Date.now();
    NodeAPI.sendMessage(
      {
        apiEndpoint: entryNode.apiEndpoint,
        accessToken: entryNode.accessToken,
        forceZeroHop: !!this.ops.forceZeroHop,
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
        this.resendRequest(request, entryNode, cacheEntry);
      });
  };

  private resendRequest(
    origReq: Request.Request,
    entryNode: EntryNode,
    cacheEntry: RequestCache.Entry
  ) {
    if (this.redoRequests.has(origReq.id)) {
      log.verbose("ignoring already triggered resend", origReq.id);
      return;
    }

    // TODO track request after segments have been sent
    this.removeRequest(origReq);

    const fallback = this.nodesColl.fallbackNodePair(entryNode);
    if (!fallback) {
      log.info("no fallback for resending request available");
      return cacheEntry.reject(
        "no fallback node pair to retry sending request"
      );
    }

    this.redoRequests.add(origReq.id);
    if (fallback.entryNode.id === origReq.entryId) {
      log.info(
        "fallback entry node same as original entry node - still trying"
      );
    }
    if (fallback.exitNode.id === origReq.exitId) {
      log.info("fallback exit node same as original exit node - still trying");
    }

    // generate new request
    const id = RequestCache.generateId(this.requestCache);
    const request = Request.create({
      crypto: this.crypto,
      id,
      provider: origReq.provider,
      req: origReq.req,
      clientId: this.clientId,
      entryId: fallback.entryNode.id,
      exitId: fallback.exitNode.id,
      exitNodeReadIdentity: this.crypto!.Identity.load_identity(
        etherUtils.arrayify(fallback.exitNode.pubKey)
      ),
    });
    // split request to segments
    const segments = Request.toSegments(request);
    if (segments.length > MAX_REQUEST_SEGMENTS) {
      log.error(
        "Resend request exceeds maximum amount of segments with %s segments - should never happen",
        segments.length,
        "new:",
        request.id,
        "original:",
        request.id
      );
      this.removeRequest(request);
      return cacheEntry.reject("Request exceeds maximum size of 3830b");
    }

    // track request
    const newCacheEntry = RequestCache.add(
      this.requestCache,
      request,
      cacheEntry.resolve,
      cacheEntry.reject,
      cacheEntry.timer
    );
    this.nodesColl.requestStarted(request);

    // send request to hoprd
    log.info("resending request %i", request.id, "for original", origReq.id);

    // send segments sequentially
    segments.forEach((s) =>
      setTimeout(() => this.resendSegment(s, request, entryNode, newCacheEntry))
    );
  }

  private resendSegment = (
    segment: Segment.Segment,
    request: Request.Request,
    entryNode: EntryNode,
    cacheEntry: RequestCache.Entry
  ) => {
    const bef = Date.now();
    NodeAPI.sendMessage(
      {
        apiEndpoint: entryNode.apiEndpoint,
        accessToken: entryNode.accessToken,
        forceZeroHop: !!this.ops.forceZeroHop,
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
        log.error(
          "error resending segment",
          Segment.prettyPrint(segment),
          error
        );
        this.nodesColl.segmentFailed(request, segment);
        this.removeRequest(request);
        return cacheEntry.reject("Sending message failed");
      });
  };

  // handle incoming messages
  private onMessages = (messages: NodeAPI.Message[]) => {
    messages.forEach(({ body }) => {
      const segRes = Segment.fromMessage(body);
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
          log.verbose("completion segment", Segment.prettyPrint(segment));
          this.completeSegmentsEntry(cacheRes.entry!);
          break;
        case "error":
          log.error("error caching segment", cacheRes.reason);
          break;
        case "already-cached":
          log.info("already cached", Segment.prettyPrint(segment));
          break;
        case "inserted-new":
          log.verbose(
            "inserted new first segment",
            Segment.prettyPrint(segment)
          );
          break;
        case "added-to-request":
          log.verbose(
            "inserted new segment to existing requestId",
            Segment.prettyPrint(segment)
          );
          break;
      }
    });
  };

  private completeSegmentsEntry = (entry: SegmentCache.Entry) => {
    const firstSeg = entry.segments.get(0)!;
    if (!firstSeg.body.startsWith("0x")) {
      log.info("message is not a response", firstSeg.requestId);
      return;
    }

    const request = this.requestCache.get(firstSeg.requestId)!;
    RequestCache.remove(this.requestCache, request.id);

    const hexResp = SegmentCache.toMessage(entry);
    const respData = etherUtils.arrayify(hexResp);
    const counter = this.counterStore.get(request.exitId) || BigInt(0);

    const res = Response.messageToResp({
      respData,
      request,
      counter,
      crypto: this.crypto,
    });
    if (Response.respSuccess(res)) {
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
        JSON.stringify(res.resp)
      );
      return request.resolve(res.resp.resp);
    } else {
      log.error("Error extracting message", res.error);
      this.nodesColl.requestFailed(request);
      return request.reject("Unable to process response");
    }
  };

  private removeRequest = (request: Request.Request) => {
    this.nodesColl.requestFailed(request);
    RequestCache.remove(this.requestCache, request.id);
    SegmentCache.remove(this.segmentCache, request.id);
    if (request.originalId) {
      this.redoRequests.delete(request.originalId);
    }
  };

  private sdkOps = (ops: Ops): Ops => {
    return {
      discoveryPlatformEndpoint:
        ops.discoveryPlatformEndpoint || defaultOps.discoveryPlatformEndpoint,
      timeout: ops.timeout || defaultOps.timeout,
      provider: ops.provider || defaultOps.provider,
      disableMevProtection:
        ops.disableMevProtection ?? defaultOps.disableMevProtection,
      mevProtectionProvider:
        ops.mevProtectionProvider || defaultOps.mevProtectionProvider,
      forceZeroHop: ops.forceZeroHop ?? defaultOps.forceZeroHop,
    };
  };

  private requestOps = (ops?: RequestOps): RequestOps => {
    if (ops) {
      return {
        timeout: ops.timeout || this.ops.timeout,
        provider: ops.provider || this.ops.provider,
      };
    }
    return this.ops;
  };

  private fetchChainId = async (provider: string) => {
    const res = await ProviderAPI.fetchChainId(provider).catch((err) =>
      log.error("Error fetching chainId for", provider, err)
    );
    if (!res) {
      return;
    }
    if (JRPC.isError(res)) {
      log.info(
        "Unable to resolve chainId for",
        provider,
        JSON.stringify(res.error)
      );
      return;
    }
    const id = parseInt(res.result, 16);
    this.chainIds.set(provider, id);
  };

  private determineProvider = (
    { provider }: { provider: string },
    { method }: JRPC.Request
  ): string => {
    if (this.ops.disableMevProtection) {
      return provider;
    }
    if (method !== "eth_sendRawTransaction") {
      return provider;
    }
    // sanity check for chain id if we got it
    const cId = this.chainIds.get(provider);
    if (cId !== 1) {
      return provider;
    }
    return this.ops.mevProtectionProvider as string;
  };

  private determineHeaders = (
    provider: string,
    mevKickbackAddress?: string
  ) => {
    if (provider === RPC_PROPELLORHEADS && mevKickbackAddress) {
      return { "X-Tx-Origin": mevKickbackAddress };
    }
  };

  private populateChainIds(provider?: string) {
    if (!provider) {
      return;
    }
    if (this.chainIds.has(provider)) {
      return;
    }
    this.fetchChainId(provider);
  }
}
