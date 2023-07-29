import type * as RPChCrypto from "@rpch/crypto";
import { hoprd } from "@rpch/common";
import { utils as etherUtils } from "ethers";
import { createLogger } from "./utils";
import * as Nodes from "./nodes";
import * as NodesAPI from "./nodes-api";
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
 * @param discoveryPlatformURL discovery platform API endpoint
 * @param timeout - timeout for receiving responses
 * @param provider - target rpc provider
 */
export type HoprSdkOps = {
  discoveryPlatformURL?: string;
  timeout?: number;
  provider?: string;
};

/**
 * Global defaults.
 * See **HoprSdkOps** for details.
 **/
const defaultOps: HoprSdkOps = {
  discoveryPlatformURL: "https://discovery.rpch.tech",
  timeout: 30e3,
  provider: "https://primary.gnosis-chain.rpc.hoprtech.net",
};

/**
 * Overridable parameters per request.
 * See **HoprSdkOps** for details.
 */
export type RequestOps = {
  timeout?: number;
  provider?: string;
};

const MAX_REQUEST_SEGMENTS = 10;
const log = createLogger();

/**
 * Send traffic through the RPCh network
 */
export default class SDK {
  private readonly requestCache: RequestCache.Cache;
  private readonly segmentCache: SegmentCache.Cache;
  private readonly counterStore: Map<string, bigint> = new Map();
  private readonly nodes: Nodes.Nodes;
  private readonly ops: HoprSdkOps;

  /**
   * Construct an SDK instance enabling RPCh requests.
   * @param cliendId your unique string used to identify how many requests your client/wallet pushes through the network
   * @param crypto crypto instantiation for RPCh, use `@rpch/crypto-for-nodejs` or `@rpch/crypto-for-web`
   * @param ops, see **HoprSdkOps**
   **/
  constructor(
    private readonly clientId: string,
    private readonly crypto: typeof RPChCrypto,
    ops: HoprSdkOps = {}
  ) {
    this.ops = {
      ...defaultOps,
      ...ops,
    };
    this.crypto = crypto;
    this.crypto.set_panic_hook();
    this.requestCache = RequestCache.init();
    this.segmentCache = SegmentCache.init();
    this.nodes = Nodes.init();
    NodesAPI.fetchEntryNode({
      excludeList: [],
      discoveryPlatformURL: this.ops.discoveryPlatformURL!,
      clientId: this.clientId,
    })
      .then(this.onEntryNode)
      .catch(this.onEntryNodeError);
  }

  public stop = () => {
    for (const [rId] of this.requestCache) {
      RequestCache.remove(this.requestCache, rId);
      SegmentCache.remove(this.segmentCache, rId);
    }
  };

  private onEntryNode = (entryNode: Nodes.EntryNode) => {
    Nodes.newEntryNode(this.nodes, entryNode);
    const wsEntryNode = Nodes.needsWebSocket(this.nodes);
    if (wsEntryNode) {
      NodesAPI.openWebSocket(entryNode, this.onWSevent(entryNode.peerId));
    }
  };

  private onWSmessage(_peerId: string, message: string) {
    const segRes = Segment.fromString(message);
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
  }

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

      this.nodesColl.finishRequest({
        entryId: request.entryId,
        exitId: request.exitId,
        requestId: request.id,
        result: true,
      });

      log.verbose("responded to %s with %s", request.body, res.body);
      try {
        const json = JSON.parse(res.body);
        return request.resolve(json);
      } catch (err) {
        log.error("Parsing response JSON failed with:", err);
        return request.reject("Unable to parse response");
      }
    } else {
      log.error("Error extracting message", res.error);
      this.nodesColl.finishRequest({
        entryId: request.entryId,
        exitId: request.exitId,
        requestId: request.id,
        result: false,
      });
      return request.reject("Unable to process response");
    }
  }

  /**
   * Resolves true when node pairs are awailable.
   * If no timeout specified, global timeout is used.
   */
  public async isReady(timeout?: number): Promise<boolean> {
    const _timeout = timeout ? timeout : this.ops.timeout!;
    return new Promise(async (resolve, reject) => {
      const res = await this.nodesColl
        .findReliableNodePair(_timeout)
        .catch((err) => {
          // keep stacktrace intact
          return reject(
            `Error finding reliable entry - exit node pair during isReady: ${err}`
          );
        });

      if (!res) {
        return resolve(false);
      }
      return resolve(
        ["entryNode", "exitNode"].reduce(
          (acc, attr) => acc && attr in res,
          true
        )
      );
    });
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
        .findReliableNodePair(reqOps.timeout!)
        .catch((_err) =>
          reject(`Error finding reliable entry - exit node pair.`)
        );
      if (!res) {
        return reject(
          `No return when searching entry - exit node pair, should never happen`
        );
      }

      // create request
      const { entryNode, exitNode } = res;
      const id = RequestCache.generateId(this.requestCache);
      const request = Request.create(
        this.crypto,
        id,
        reqOps.provider!,
        JSON.stringify(req),
        entryNode.peerId,
        exitNode.peerId,
        this.crypto!.Identity.load_identity(
          etherUtils.arrayify(exitNode.pubKey)
        )
      );

      // set request expiration timer
      const timer = setTimeout(() => {
        log.error("request expired", request.id);
        this.rejectRequest(request);
        return reject("request timed out");
      }, reqOps.timeout!);

      // track request
      RequestCache.add(this.requestCache, request, resolve, reject, timer);

      this.nodesColl.startRequest({
        entryId: entryNode.peerId,
        exitId: exitNode.peerId,
        requestId: request.id,
      });

      // split request to segments
      const segments = Request.toSegments(request);
      if (segments.length > MAX_REQUEST_SEGMENTS) {
        log.error(
          "Request exceeds maximum amount of segments with %s segments",
          segments.length
        );
        this.rejectRequest(request);
        return reject("Request exceeds maximum size of 3830b");
      }

      // send request to hoprd
      log.info("sending request %i", request.id);

      // Send all segments in parallel using Promise.allSettled
      const sendMessagePromises = segments.map((segment: any) => {
        return hoprd.sendMessage({
          apiEndpoint: entryNode.apiEndpoint.toString(),
          apiToken: entryNode.apiToken,
          message: Segment.toPayload(segment),
          destination: request.exitId,
          path: [],
        });
      });

      // Wait for all promises to settle, then check if any were rejected
      try {
        const results = await Promise.allSettled(sendMessagePromises);
        const rejectedResults = results.filter(
          (result: any) => result.status === "rejected"
        );

        // check rejected segment sending
        if (rejectedResults.length > 0) {
          log.error("Failed sending segments", rejectedResults);
          this.rejectRequest(request);
          return reject("not all segments were delivered");
        }
      } catch (err) {
        // check other errors
        log.error("Error during sending segments", err);
        this.rejectRequest(request);
        return reject("Error during sending segments");
      }
    });
  }

  private rejectRequest(request: Request.Request) {
    this.nodesColl.finishRequest({
      entryId: request.entryId,
      exitId: request.exitId,
      requestId: request.id,
      result: false,
    });
    RequestCache.remove(this.requestCache, request.id);
    SegmentCache.remove(this.segmentCache, request.id);
  }
}
