import type * as RPChCrypto from "@rpch/crypto";
import {
  Cache as SegmentCache,
  Message,
  Request,
  Response,
  Segment,
  hoprd,
  utils,
} from "@rpch/common";
import { utils as etherUtils } from "ethers";
import debug from "debug";
import RequestCache from "./request-cache";
import { createLogger } from "./utils";
import NodesCollector from "./nodes-collector";

const log = createLogger();
const DEFAULT_MAXIMUM_SEGMENTS_PER_REQUEST = 10;
const DEFAULT_RESET_NODE_METRICS_MS = 1e3 * 60 * 5; // 5 min
const DEFAULT_MINIMUM_SCORE_FOR_RELIABLE_NODE = 0.8;
const DEFAULT_MAX_ENTRY_NODES = 2;
const CACHES_EXPIRATION_TIMEOUT = 1e3 * 5; // 5 sec

/**
 * HOPR SDK options.
 * @param crypto RPCh crypto library to use
 * @param discoveryPlatformApiEndpoint The discovery platform API endpoint
 * @param client The client that will be used to pay for messaging
 * @param timeout The timeout of pending requests
 * @param maximumSegmentsPerRequest Optional: Blocks requests that are made up of more than 10 segments
 * @param resetNodeMetricsMs Optional: Reset score metrics after specifies miliseconds
 * @param minimumScoreForReliableNode Optional: Nodes with lower score than this will be swapped for new ones
 * @param maxEntryNodes Optional: How many entry nodes to use in parallel
 * @param reliabilityScoreFreshNodeThreshold Optional: The score which is considered fresh for a node
 * @param reliabilityScoreMaxResponses Optional: Maximum amount of responses to keep in memory
 * @param forceEntryNode Optional: Force to use a specific entry node
 * @param forceExitNode Optional: Force to use a specific exit node
 */
export type HoprSdkOps = {
  crypto: typeof RPChCrypto;
  discoveryPlatformApiEndpoint: string;
  client: string;
  timeout: number;
  maximumSegmentsPerRequest?: number;
  resetNodeMetricsMs?: number;
  minimumScoreForReliableNode?: number;
  maxEntryNodes?: number;
  reliabilityScoreFreshNodeThreshold?: number;
  reliabilityScoreMaxResponses?: number;
  forceEntryNode?: EntryNode;
  forceExitNode?: ExitNode;
};

/**
 * Entry Node details
 */
export type EntryNode = {
  apiEndpoint: string;
  apiToken: string;
  peerId: string;
  stopMessageListener?: () => void;
};

/**
 * Exit Node details
 */
export type ExitNode = {
  peerId: string;
  pubKey: string;
};

/**
 * Send traffic through the RPCh network
 */
export default class SDK {
  // various options that can be overwritten by user
  private maximumSegmentsPerRequest: number =
    DEFAULT_MAXIMUM_SEGMENTS_PER_REQUEST;
  private resetNodeMetricsMs: number = DEFAULT_RESET_NODE_METRICS_MS;
  private minimumScoreForReliableNode: number =
    DEFAULT_MINIMUM_SCORE_FOR_RELIABLE_NODE;
  private maxEntryNodes: number = DEFAULT_MAX_ENTRY_NODES;
  // RPCh crypto library used
  private crypto: typeof RPChCrypto;
  // various intervals used to clear the caches
  private intervals: NodeJS.Timer[] = [];
  private segmentCache: SegmentCache;
  private requestCache: RequestCache;
  private selectingEntryNodes: boolean = false;
  private nodesColl: NodesCollector;
  // allows developers to programmatically enable debugging
  public debug = debug;
  // toogle to not start if it's already starting
  public starting: boolean = false;
  // resolves once SDK has started
  public startingPromise = new utils.DeferredPromise<void>();

  constructor(
    private readonly ops: HoprSdkOps,
    // eslint-disable-next-line no-unused-vars
    private setKeyVal: (key: string, val: string) => Promise<void>,
    // eslint-disable-next-line no-unused-vars
    private getKeyVal: (key: string) => Promise<string | undefined>
  ) {
    this.crypto = ops.crypto;
    this.crypto.set_panic_hook();
    this.segmentCache = new SegmentCache((message: any) =>
      this.onMessage(message)
    );
    this.requestCache = new RequestCache((request) =>
      this.onRequestExpiration(request)
    );
    // set to default if not specified
    this.maximumSegmentsPerRequest =
      ops.maximumSegmentsPerRequest ?? DEFAULT_MAXIMUM_SEGMENTS_PER_REQUEST;
    this.resetNodeMetricsMs =
      ops.resetNodeMetricsMs ?? DEFAULT_RESET_NODE_METRICS_MS;
    this.minimumScoreForReliableNode =
      ops.minimumScoreForReliableNode ??
      DEFAULT_MINIMUM_SCORE_FOR_RELIABLE_NODE;
    this.maxEntryNodes = ops.maxEntryNodes ?? DEFAULT_MAX_ENTRY_NODES;
    this.nodesColl = new NodesCollector(
      ops.discoveryPlatformApiEndpoint,
      ops.client,
      (peerId, message) => this.onWSmessage(peerId, message)
    );
    this.intervals.push(
      setInterval(() => {
        // check for expires caches every second
        this.segmentCache.removeExpired(this.ops.timeout);
        this.requestCache.removeExpired(this.ops.timeout);
      }, CACHES_EXPIRATION_TIMEOUT) // look for entry nodes every 5 seconds
    );
  }

  public stop = () => {
    this.intervals.forEach(clearInterval);
    this.nodesColl.stop();
  };

  private onWSmessage(_peerId: string, message: string) {
    // handle incoming messages
    try {
      const segment = Segment.fromString(message);
      this.segmentCache.onSegment(segment);
    } catch {
      log.verbose(
        "rejected received data from HOPRd: not a valid segment",
        message
      );
    }
  }

  /**
   * Resolve request promise and delete the request from map
   * @param message Message received from cache module
   */
  private async onMessage(message: Message): Promise<void> {
    // check whether we have a response
    if (!message.body.startsWith("0x")) {
      log.verbose("message is not a response", message.id, message.body);
      return;
    }

    // check whether we have a matching request id
    const match = this.requestCache.getRequest(message.id);
    if (!match) {
      log.verbose("matching request not found", message.id);
      return;
    }
    this.requestCache.removeRequest(match.request);

    try {
      const counter = await this.getKeyVal(
        match.request.exitNodeDestination
      ).then((k) => BigInt(k || "0"));

      // construct Response from Message
      const response = await Response.fromMessage(
        this.crypto!,
        match.request,
        message,
        counter,
        (exitNodeId, counter) => {
          return this.setKeyVal(exitNodeId, counter.toString());
        }
      );
      const responseTime = Date.now() - match.createdAt.getTime();
      log.verbose(
        "response time for request %s: %s ms, counter %i",
        match.request.id,
        responseTime,
        counter
      );

      this.nodesColl.finishRequest({
        entryId: match.request.entryNodeDestination,
        exitId: match.request.exitNodeDestination,
        requestId: match.request.id,
        result: true,
      });

      log.verbose("responded to %s with %s", match.request.body, response.body);
      match.resolve(response);
    } catch (e) {
      log.verbose(
        "failed to load received message id %i from %s with error",
        message.id,
        match.request.exitNodeDestination,
        e
      );
      this.handleFailedRequest(
        match.request,
        "failed to load received message"
      );
    }
  }

  /**
   * Adds a failed metric to the reliability score
   * when the request expires.
   * @param req Request received from cache module.
   */
  private onRequestExpiration(req: Request): void {
    log.normal("request %i expired", req.id);
    this.nodesColl.finishRequest({
      entryId: req.entryNodeDestination,
      exitId: req.exitNodeDestination,
      requestId: req.id,
      result: false,
    });
  }

  /**
   * Remove request from requestCache and add failed metric
   * @param req Request
   * @returns void
   */
  public handleFailedRequest(req: Request, reason?: string) {
    log.normal("request %i failed", req.id, reason || "unknown reason");
    // add metric failed metric
    this.nodesColl.finishRequest({
      entryId: req.entryNodeDestination,
      exitId: req.exitNodeDestination,
      requestId: req.id,
      result: false,
    });
    // reject request promise
    this.requestCache.getRequest(req.id)?.reject(`request failed: "${reason}"`);
    this.requestCache.removeRequest(req);
  }

  /**
   * Resolves true when node pairs are awailable.
   */
  public async isReady(timeout: number = 10e3): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const res = await this.nodesColl
        .findReliableNodePair(timeout)
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
   * Sends a Request through the RPCh network
   * @param provider
   * @param body
   * @returns Promise<Response>
   */
  public async sendRequest(
    provider: string,
    body: string,
    timeout: number = 10e3
  ): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      const res = await this.nodesColl
        .findReliableNodePair(timeout)
        .catch((err) => {
          // keep stacktrace intact
          return reject(
            `Error finding reliable entry - exit node pair: ${err}`
          );
        });
      if (!res) {
        return reject(
          `No return when searching entry - exit node pair, should never happen`
        );
      }

      const { entryNode, exitNode } = res;
      const req = await Request.createRequest(
        this.crypto!,
        provider,
        body,
        entryNode.peerId,
        exitNode.peerId,
        this.crypto!.Identity.load_identity(
          etherUtils.arrayify(exitNode.pubKey)
        )
      );
      this.nodesColl.startRequest({
        entryId: entryNode.peerId,
        exitId: exitNode.peerId,
        requestId: req.id,
      });
      log.normal("sending request %i", req.id);
      const message = req.toMessage();
      const segments = message.toSegments();

      if (segments.length > this.maximumSegmentsPerRequest) {
        log.error(
          "Request exceeds maximum amount of segments with %s segments",
          segments.length
        );
        return reject("Request is too big");
      }

      // Add request to request cache
      this.requestCache.addRequest(req, resolve, reject);

      // Send all segments in parallel using Promise.allSettled
      const sendMessagePromises = segments.map((segment: any) => {
        return hoprd.sendMessage({
          apiEndpoint: entryNode.apiEndpoint.toString(),
          apiToken: entryNode.apiToken,
          message: segment.toString(),
          destination: req.exitNodeDestination,
          path: [],
        });
      });

      // Wait for all promises to settle, then check if any were rejected
      try {
        const results = await Promise.allSettled(sendMessagePromises);
        const rejectedResults = results.filter(
          (result: any) => result.status === "rejected"
        );

        if (rejectedResults.length > 0) {
          // If any promises were rejected, remove request from cache and reject promise
          const reason = "not all segments were delivered";
          this.handleFailedRequest(req, reason);
          reject(reason);
        }
      } catch (e: any) {
        // If there was an error sending the request, remove request from cache and reject promise
        this.handleFailedRequest(req, e);
        reject(e);
      }
    });
  }
}
