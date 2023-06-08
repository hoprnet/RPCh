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
import fetch from "cross-fetch";
import retry from "async-retry";
import ReliabilityScore, { type Result } from "./reliability-score";
import RequestCache from "./request-cache";
import { createLogger } from "./utils";

const log = createLogger();
const DEFAULT_MAXIMUM_SEGMENTS_PER_REQUEST = 10;
const DEFAULT_RESET_NODE_METRICS_MS = 1e3 * 60 * 60 * 15; // 15min
const DEFAULT_DEADLOCK_MS = 1e3 * 5; // 5s
const DEFAULT_MINIMUM_SCORE_FOR_RELIABLE_NODE = 0.8;
const DEFAULT_RELIABILITY_SCORE_FRESH_NODE_THRESHOLD = 20;
const DEFAULT_RELIABILITY_SCORE_MAX_RESPONSES = 100;
const DEFAULT_MAX_ENTRY_NODES = 2;

/**
 * HOPR SDK options.
 * @param crypto RPCh crypto library to use
 * @param discoveryPlatformApiEndpoint The discovery platform API endpoint
 * @param client The client that will be used to pay for messaging
 * @param timeout The timeout of pending requests
 * @param maximumSegmentsPerRequest Optional: Blocks requests that are made up of more than 10 segments
 * @param resetNodeMetricsMs Optional: Reset score metrics after specifies miliseconds
 * @param deadlockMs Optional: How long to pause the SDK before sending more requests to the discovery platform after an error
 * @param disableDeadlock Optional: Disable deadlocking
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
  deadlockMs?: number;
  disableDeadlock?: boolean;
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
  private deadlockMs: number = DEFAULT_DEADLOCK_MS;
  private minimumScoreForReliableNode: number =
    DEFAULT_MINIMUM_SCORE_FOR_RELIABLE_NODE;
  private maxEntryNodes: number = DEFAULT_MAX_ENTRY_NODES;
  // RPCh crypto library used
  private crypto: typeof RPChCrypto;
  // our chosen entry nodes
  private entryNodes: Map<string, EntryNode> = new Map();
  // available exit nodes we can use
  private exitNodes: ExitNode[] = [];
  // various intervals used to clear the caches
  private intervals: NodeJS.Timer[] = [];
  private segmentCache: SegmentCache;
  private requestCache: RequestCache;
  private selectingEntryNodes: boolean = false;
  // an epoch timestamp that halts selecting new entry nodes
  public deadlockTimestamp: number | undefined;
  // keeps track a reliability score for every entry-node used
  private reliabilityScore: ReliabilityScore;
  // allows developers to programmatically enable debugging
  public debug = debug;
  // toogle to not start if it's already starting
  public starting: boolean = false;
  // resolves once SDK has started
  public startingPromise = new utils.DeferredPromise<void>();

  constructor(
    private readonly ops: HoprSdkOps,
    // eslint-disable-next-line no-unused-vars
    private setKeyVal: (key: string, val: string) => Promise<any>,
    // eslint-disable-next-line no-unused-vars
    private getKeyVal: (key: string) => Promise<string | undefined>
  ) {
    this.crypto = ops.crypto;
    this.crypto.set_panic_hook();
    this.segmentCache = new SegmentCache((message) => this.onMessage(message));
    this.requestCache = new RequestCache((request) =>
      this.onRequestExpiration(request)
    );
    this.reliabilityScore = new ReliabilityScore(
      ops.reliabilityScoreFreshNodeThreshold ||
        DEFAULT_RELIABILITY_SCORE_FRESH_NODE_THRESHOLD,
      ops.reliabilityScoreMaxResponses ||
        DEFAULT_RELIABILITY_SCORE_MAX_RESPONSES
    );
    // set to default if not specified
    this.maximumSegmentsPerRequest =
      ops.maximumSegmentsPerRequest ?? DEFAULT_MAXIMUM_SEGMENTS_PER_REQUEST;
    this.resetNodeMetricsMs =
      ops.resetNodeMetricsMs ?? DEFAULT_RESET_NODE_METRICS_MS;
    this.deadlockMs = ops.deadlockMs ?? DEFAULT_DEADLOCK_MS;
    this.minimumScoreForReliableNode =
      ops.minimumScoreForReliableNode ??
      DEFAULT_MINIMUM_SCORE_FOR_RELIABLE_NODE;
    this.maxEntryNodes = ops.maxEntryNodes ?? DEFAULT_MAX_ENTRY_NODES;
  }

  /**
   * @return true if SDK is ready to send requests
   */
  public get isReady(): boolean {
    return this.entryNodes.size > 0 && this.exitNodes.length > 0;
  }

  /**
   * Will select until nodes until MAX is reached.
   * Ignores "bad" nodes.
   * @param discoveryPlatformApiEndpoint
   */
  private async selectEntryNodes(
    discoveryPlatformApiEndpoint: string
  ): Promise<void> {
    if (this.selectingEntryNodes || this.isDeadlocked()) return;
    try {
      // we only need 1 when we force an entry node
      const amountNeeded =
        (this.ops.forceEntryNode ? 1 : this.maxEntryNodes) -
        this.entryNodes.size;
      if (amountNeeded === 0) return;

      let brokenNodes: string[] = [];
      if (this.ops.forceEntryNode) {
        // we pretend everything is okay if we need to force an entry node
        brokenNodes = [];
      } else {
        brokenNodes = this.reliabilityScore
          .getScores()
          .filter(({ peerId }) => !this.isEntryNodeReliable(peerId))
          .map(({ peerId }) => peerId);
      }

      log.normal(
        `Selecting '${amountNeeded}' entry nodes and excluding`,
        brokenNodes.length == 0 ? "none" : brokenNodes.join(",")
      );
      this.selectingEntryNodes = true;

      // get new entry nodes
      let entryNodes: EntryNode[] = [];
      for (let i = 0; i < amountNeeded; i++) {
        const excludeList: string[] = [
          ...brokenNodes,
          ...entryNodes.map((e) => e.peerId),
        ];
        const entryNode = await retry(
          async () => {
            return this.selectEntryNode(
              discoveryPlatformApiEndpoint,
              excludeList
            );
          },
          {
            retries: 5,
            onRetry: (e, attempt) => {
              log.error("Error while selecting entry node", e);
              log.verbose("Retrying to select entry node, attempt:", attempt);
            },
          }
        );
        entryNodes.push(entryNode);
      }
    } catch (error) {
      log.error("Couldn't find new entry node: ", error);
      if (!this.ops.disableDeadlock) this.setDeadlock(this.deadlockMs);
      throw error;
    } finally {
      this.selectingEntryNodes = false;
    }
  }

  /**
   * Stop WS listener and removes entry node from our list.
   * @param peerId
   */
  private removeEntryNode(peerId: string): void {
    const entryNode = this.entryNodes.get(peerId);
    if (entryNode && !this.isEntryNodeReliable(peerId)) {
      if (entryNode.stopMessageListener) entryNode.stopMessageListener();
      this.entryNodes.delete(peerId);
    }
  }

  /**
   * Requests the Discovery Platform for an Entry Node.
   * @param discoveryPlatformApiEndpoint
   * @return entry node details
   */
  private async selectEntryNode(
    discoveryPlatformApiEndpoint: string,
    excludeList?: string[]
  ): Promise<EntryNode> {
    log.verbose("Selecting entry node");

    let entryNode: EntryNode;
    // use forced entry node
    if (this.ops.forceEntryNode) {
      entryNode = this.ops.forceEntryNode;
    }
    // ask discovery platform
    else {
      const rawResponse: globalThis.Response = await fetch(
        new URL(
          "/api/v1/request/entry-node",
          discoveryPlatformApiEndpoint
        ).toString(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept-Content": "application/json",
            "x-rpch-client": this.ops.client,
          },
          body: JSON.stringify({
            excludeList,
            client: this.ops.client,
          }),
        }
      );

      // Check for error response
      if (rawResponse.status !== 200) {
        log.error(
          "Failed to request entry node",
          rawResponse.status,
          await rawResponse.text()
        );
        throw new Error(`Failed to request entry node`);
      }

      const response: {
        hoprd_api_endpoint: string;
        accessToken: string;
        id: string;
      } = await rawResponse.json();

      const apiEndpointUrl = new URL(response.hoprd_api_endpoint);

      entryNode = {
        apiEndpoint: apiEndpointUrl.toString(),
        apiToken: response.accessToken,
        peerId: response.id,
      };
    }

    log.verbose(
      "Selected entry node",
      entryNode,
      `forced=${!!this.ops.forceEntryNode}`
    );

    // stop message listening from the previous node
    if (this.entryNodes.has(entryNode.peerId)) {
      const prevEntryNode = this.entryNodes.get(entryNode.peerId);
      if (prevEntryNode?.stopMessageListener) {
        prevEntryNode.stopMessageListener();
      }
    }
    // create new WS connection
    const connection = await hoprd.createMessageListener(
      entryNode.apiEndpoint,
      entryNode.apiToken,
      (message) => {
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
    );
    entryNode.stopMessageListener = () => {
      if (connection.close) connection.close();
    };

    this.entryNodes.set(entryNode.peerId, entryNode);
    return entryNode;
  }

  /**
   * Updates exit node list from the Discovery Platform
   * @param discoveryPlatformApiEndpoint
   * @returns list of exit nodes
   */
  private async fetchExitNodes(
    discoveryPlatformApiEndpoint: string
  ): Promise<ExitNode[]> {
    log.verbose("Fetching exit nodes");

    if (this.ops.forceExitNode) {
      log.verbose("Forcing to use exit node", this.ops.forceExitNode);
      this.exitNodes = [this.ops.forceExitNode];
    } else {
      const rawResponse = await fetch(
        new URL(
          "/api/v1/node?hasExitNode=true",
          discoveryPlatformApiEndpoint
        ).toString(),
        {
          headers: {
            "Content-Type": "application/json",
            "Accept-Content": "application/json",
            "x-rpch-client": this.ops.client,
          },
        }
      );

      if (rawResponse.status !== 200) {
        throw new Error("Failed to fetch exit nodes");
      }

      const response: {
        exit_node_pub_key: string;
        id: string;
      }[] = await rawResponse.json();

      this.exitNodes = response.map((item) => ({
        peerId: item.id,
        pubKey: item.exit_node_pub_key,
      }));
    }

    if (this.exitNodes.length === 0) throw Error("No exit nodes available");

    log.verbose(
      "Fetched exit nodes",
      this.exitNodes.length,
      `forced=${!!this.ops.forceExitNode}`
    );
    return this.exitNodes;
  }

  /**
   * Resolve request promise and delete the request from map
   * @param message Message received from cache module
   */
  private async onMessage(message: Message): Promise<void> {
    // check whether we have a matching request id
    const match = this.requestCache.getRequest(message.id);
    if (!match) {
      log.verbose("matching request not found", message.id);
      return;
    }

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
          this.setKeyVal(exitNodeId, counter.toString());
        }
      );
      const responseTime = Date.now() - match.createdAt.getTime();
      log.verbose(
        "response time for request %s: %s ms",
        match.request.id,
        responseTime
      );

      this.requestCache.removeRequest(match.request);
      match.resolve(response);

      this.reliabilityScore.addMetric(
        match.request.entryNodeDestination,
        match.request.id,
        "success"
      );

      log.normal("received response for %i", match.request.id);
      log.verbose("responded to %s with %s", match.request.body, response.body);
    } catch (e) {
      log.verbose(
        "failed to decrypt message id %i from %s with body",
        message.id,
        match.request.exitNodeDestination
      );
      this.handleFailedRequest(match.request, "failed to decrypt");
    }
  }

  /**
   * Updates the score of an entry node.
   * Removes it if it ranks too low.
   * @param req
   * @param result
   */
  private updateEntryNodeScore(req: Request, result: Result): void {
    this.reliabilityScore.addMetric(req.entryNodeDestination, req.id, result);
    // remove entry node as soon as we find its not reliable
    this.removeEntryNode(req.entryNodeDestination);
  }

  /**
   * Adds a failed metric to the reliability score
   * when the request expires.
   * @param req Request received from cache module.
   */
  private onRequestExpiration(req: Request): void {
    log.normal("request %i expired", req.id);
    this.updateEntryNodeScore(req, "failed");
  }

  /**
   * Remove request from requestCache and add failed metric
   * @param req Request
   * @returns void
   */
  public handleFailedRequest(req: Request, reason?: string) {
    log.normal("request %i failed", req.id, reason || "unknown reason");
    // add metric failed metric
    this.updateEntryNodeScore(req, "failed");
    // reject request promise
    this.requestCache.getRequest(req.id)?.reject(`request failed: "${reason}"`);
    this.requestCache.removeRequest(req);
  }

  /**
   * Start the SDK and initialize necessary data.
   */
  public async start(): Promise<void> {
    // already started
    if (this.isReady) return;
    // already in the proccess of starting
    if (this.starting) return this.startingPromise.promise;

    try {
      this.starting = true;

      // fetch entry nodes from discovery platform
      await this.selectEntryNodes(this.ops.discoveryPlatformApiEndpoint);

      // fetch exit nodes from discovery platform
      await retry(
        () => this.fetchExitNodes(this.ops.discoveryPlatformApiEndpoint),
        {
          retries: 5,
          onRetry: (e, attempt) => {
            log.error("Error while fetching exit nodes", e);
            log.verbose("Retrying to fetch exit nodes, attempt:", attempt);
          },
        }
      );

      this.intervals.push(
        setInterval(() => {
          // check for expires caches every second
          this.segmentCache.removeExpired(this.ops.timeout);
          this.requestCache.removeExpired(this.ops.timeout);

          // checks whether to fetch new entry nodes
          this.selectEntryNodes(this.ops.discoveryPlatformApiEndpoint).catch(
            (error) => {
              log.error("Failed to select entry nodes", error);
            }
          );

          // remove unstable entry nodes
          for (const peerId of this.entryNodes.keys()) {
            if (!this.isEntryNodeReliable(peerId)) this.removeEntryNode(peerId);
          }

          // reset old nodes from reliability score
          this.reliabilityScore.resetOldNodeMetrics(this.resetNodeMetricsMs);
        }, 1e3)
      );

      this.intervals.push(
        setInterval(() => {
          // logs the status of the entry nodes
          let logStr = `Using '${this.entryNodes.size}' entry nodes with score:`;
          for (const peerId of this.entryNodes.keys()) {
            logStr += "\n";
            logStr += `  ${peerId}: ${this.reliabilityScore.getScore(
              peerId
            )} ${this.reliabilityScore.getStatus(peerId)}`;
          }
          log.normal(logStr);
        }, 10e3)
      );

      this.intervals.push(
        setInterval(() => {
          // update exit nodes every minute
          this.fetchExitNodes(this.ops.discoveryPlatformApiEndpoint).catch(
            (error) => {
              log.error("Failed to fetch exit nodes", error);
            }
          );
        }, 60e3)
      );

      this.startingPromise.resolve();
      log.normal("SDK started");
    } catch (e: any) {
      this.startingPromise.reject(e.message);
      log.normal("SDK failed to start", e.message);
    } finally {
      this.starting = false;
    }
  }

  /**
   * Stop the SDK and clear up tangling processes.
   */
  public async stop(): Promise<void> {
    // stop all WS listeners
    for (const { stopMessageListener } of this.entryNodes.values()) {
      if (stopMessageListener) stopMessageListener();
    }
    // remove all intervals
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
  }

  /**
   * @param entryNode
   * @returns `true` is entry node is reliable
   */
  private isEntryNodeReliable(entryNodePeerId: string): boolean {
    const score = this.reliabilityScore.getScore(entryNodePeerId);
    const status = this.reliabilityScore.getStatus(entryNodePeerId);
    const hasLowScore = score < this.minimumScoreForReliableNode;
    const isNotFresh = status === "NON_FRESH";
    return !(hasLowScore && isNotFresh);
  }

  /**
   * Creates a Request instance that can be sent through the RPCh network
   * @param provider
   * @param body
   * @returns Request
   */
  public async createRequest(provider: string, body: string): Promise<Request> {
    if (!this.isReady) throw Error("SDK not ready to create requests");

    // get reliable entry nodes
    const reliableEntryNodes = Array.from(this.entryNodes.values()).filter(
      (entryNode) => this.isEntryNodeReliable(entryNode.peerId)
    );
    if (reliableEntryNodes.length === 0) {
      throw Error("SDK does not have any reliable entry nodes");
    }
    const entryNode = utils.randomlySelectFromArray(reliableEntryNodes);

    // exclude entry node
    const eligibleExitNodes = this.exitNodes.filter(
      (node) => node.peerId !== entryNode.peerId
    );
    if (eligibleExitNodes.length === 0) {
      throw Error("SDK does not have any eligible exit nodes");
    }
    const exitNode = utils.randomlySelectFromArray(eligibleExitNodes);
    return await Request.createRequest(
      this.crypto!,
      provider,
      body,
      entryNode.peerId,
      exitNode.peerId,
      this.crypto!.Identity.load_identity(etherUtils.arrayify(exitNode.pubKey))
    );
  }

  /**
   * Checks if sdk should be in deadlock
   * @returns boolean
   */
  private isDeadlocked(): boolean {
    if (!this.deadlockTimestamp) return false;
    const now = Date.now();
    if (now < this.deadlockTimestamp) {
      log.verbose("SDK is deadlocked until", this.deadlockTimestamp);
      return true;
    }
    return false;
  }

  /**
   * Sets timestamp by adding time now and received parameter
   * @param timeInMs number
   */
  public setDeadlock(timeInMs: number): void {
    const now = Date.now();
    this.deadlockTimestamp = timeInMs + now;
    log.verbose("new deadlock timestamp", this.deadlockTimestamp);
  }

  /**
   * Sends a Request through the RPCh network
   * @param req Request
   * @returns Promise<Response>
   */
  public async sendRequest(req: Request): Promise<Response> {
    // Check if SDK is ready to send requests
    if (!this.isReady) {
      throw Error("SDK not ready to send requests");
    }

    return new Promise(async (resolve, reject) => {
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
      const sendMessagePromises = segments.map((segment) => {
        const entryNode = this.entryNodes.get(req.entryNodeDestination);
        if (!entryNode) throw Error("EntryNode is no longer reliable");
        return hoprd.sendMessage({
          apiEndpoint: entryNode.apiEndpoint,
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
          (result) => result.status === "rejected"
        );

        if (rejectedResults.length > 0) {
          // If any promises were rejected, remove request from cache and reject promise
          this.handleFailedRequest(req, "not all segments were delivered");
        }
      } catch (e: any) {
        // If there was an error sending the request, remove request from cache and reject promise
        this.handleFailedRequest(req, e);
      }
    });
  }
}
