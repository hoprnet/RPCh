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
import ReliabilityScore from "./reliability-score";
import RequestCache from "./request-cache";
import { createLogger } from "./utils";

const log = createLogger();
// max number of segments sdk can send to entry node
const MAXIMUM_SEGMENTS_PER_REQUEST = 100;
const DEADLOCK_MS = 1e3 * 60 * 0.5; // 30s
const MINIMUM_SCORE_FOR_RELIABLE_NODE = 0.7;

/**
 * HOPR SDK options.
 */
export type HoprSdkOps = {
  crypto: typeof RPChCrypto;
  client: string;
  timeout: number;
  discoveryPlatformApiEndpoint: string;
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
  // allows developers to programmatically enable debugging
  public debug = debug;
  private crypto: typeof RPChCrypto;
  // single interval for the SDK for things that need to be checked.
  private intervals: NodeJS.Timer[] = [];
  private segmentCache: SegmentCache;
  private requestCache: RequestCache;
  private reliabilityScore: ReliabilityScore;
  // selected entry node
  private entryNode?: EntryNode;
  // available exit nodes
  private exitNodes: ExitNode[] = [];
  // stopMessageListener
  private stopMessageListener?: () => void;
  // an epoch timestamp that stops creating requests until that time has passed
  public deadlockTimestamp: number | undefined;
  // toggle to not select entry nodes while another one is being selected
  private selectingEntryNode: boolean | undefined;
  // toogle to not start if it's already starting
  public starting: boolean | undefined;

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
      this.onRequestRemoval(request)
    );
    this.reliabilityScore = new ReliabilityScore(
      ops.reliabilityScoreFreshNodeThreshold || 20,
      ops.reliabilityScoreMaxResponses || 100
    );
  }

  /**
   * @return true if SDK is ready to send requests
   */
  public get isReady(): boolean {
    return !!this.entryNode && this.exitNodes.length > 0;
  }

  /**
   * Requests the Discovery Platform for an Entry Node.
   * @param discoveryPlatformApiEndpoint
   * @return entry node details
   */
  private async selectEntryNode(
    discoveryPlatformApiEndpoint: string,
    exclusionList?: string[]
  ): Promise<{
    apiEndpoint: string;
    apiToken: string;
    peerId: string;
  }> {
    try {
      this.selectingEntryNode = true;
      log.verbose("Selecting entry node");

      // use forced entry node
      if (this.ops.forceEntryNode) {
        this.entryNode = this.ops.forceEntryNode;
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
              exclusionList,
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

        this.entryNode = {
          apiEndpoint: apiEndpointUrl.toString(),
          apiToken: response.accessToken,
          peerId: response.id,
        };
      }

      log.verbose(
        "Selected entry node",
        this.entryNode,
        `forced=${!!this.ops.forceEntryNode}`
      );

      // Refresh messageListener
      if (this.stopMessageListener) this.stopMessageListener();
      const connection = await hoprd.createMessageListener(
        this.entryNode!.apiEndpoint,
        this.entryNode!.apiToken,
        (message) => {
          try {
            const segment = Segment.fromString(message);
            this.segmentCache.onSegment(segment);
          } catch (error) {
            log.verbose(
              "rejected received data from HOPRd: not a valid segment",
              message
            );
          }
        }
      );
      this.stopMessageListener = () => {
        if (connection.close) connection.close();
      };
      return this.entryNode;
    } catch (error) {
      throw error;
    } finally {
      this.selectingEntryNode = false;
    }
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

      log.verbose("responded to %s with %s", match.request.body, response.body);
    } catch (e) {
      log.error(
        "failed to decrypt message id %s with body",
        message.id,
        message.body
      );
      this.handleFailedRequest(match.request, "failed to decrypt");
    }
  }

  /**
   * Adds a failed metric to the reliability score
   * when the request expires.
   * @param req Request received from cache module.
   */
  private onRequestRemoval(req: Request): void {
    // @ts-ignore
    this.reliabilityScore.addMetric(req.entryNodeDestination, req.id, "failed");
    log.normal("request %s expired", req.id);
  }

  /**
   * Remove request from requestCache and add failed metric
   * @param req Request
   * @returns void
   */
  public handleFailedRequest(req: Request, reason?: string) {
    // add metric failed metric
    this.onRequestRemoval(req);
    // reject request promise
    this.requestCache.getRequest(req.id)?.reject(`request failed: "${reason}"`);
    this.requestCache.removeRequest(req);
  }

  /**
   * Start the SDK and initialize necessary data.
   */
  public async start(): Promise<void> {
    if (this.isReady) return;
    try {
      if (this.starting) throw Error("SDK is already starting");
      this.starting = true;

      // fetch required data from discovery platform
      await retry(
        () => this.selectEntryNode(this.ops.discoveryPlatformApiEndpoint),
        {
          retries: 5,
          onRetry: (e, attempt) => {
            log.error("Error while selecting entry node", e);
            log.verbose("Retrying to select entry node, attempt:", attempt);
          },
        }
      );

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

      // check for expires caches every second
      this.intervals.push(
        setInterval(() => {
          this.segmentCache.removeExpired(this.ops.timeout);
          this.requestCache.removeExpired(this.ops.timeout);
        }, 1e3)
      );
      // update exit nodes every minute
      this.intervals.push(
        setInterval(() => {
          this.fetchExitNodes(this.ops.discoveryPlatformApiEndpoint).catch(
            (error) => {
              log.error("Failed to fetch exit nodes", error);
            }
          );
        }, 60e3)
      );
    } catch (e: any) {
      log.error("Could not start SDK", e.message);
    } finally {
      this.starting = false;
    }
  }

  /**
   * Stop the SDK and clear up tangling processes.
   */
  public async stop(): Promise<void> {
    if (this.stopMessageListener) this.stopMessageListener();
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
  }

  /**
   * Creates a Request instance that can be sent through the RPCh network
   * @param provider
   * @param body
   * @returns Request
   */
  public async createRequest(provider: string, body: string): Promise<Request> {
    if (!this.isReady) throw Error("SDK not ready to create requests");
    if (this.selectingEntryNode) throw Error("SDK is selecting entry node");

    let entryNodeScore: number = this.reliabilityScore.getScore(
      this.entryNode!.peerId
    );
    const exclusionList: string[] = [];
    if (
      entryNodeScore < MINIMUM_SCORE_FOR_RELIABLE_NODE &&
      this.reliabilityScore.getStatus(this.entryNode!.peerId) === "NON_FRESH" &&
      !this.selectingEntryNode
    ) {
      this.selectingEntryNode = true;
      log.verbose("node is not reliable enough. selecting new entry node");
      exclusionList.push(this.entryNode!.peerId);
      // Try to select entry node 3 times
      try {
        await retry(
          async () => {
            const selectedEntryNode = await this.selectEntryNode(
              this.ops.discoveryPlatformApiEndpoint,
              exclusionList
            );
            log.verbose("Received entry node", selectedEntryNode);
            return selectedEntryNode;
          },
          {
            retries: 3,
            onRetry: (e, attempt) => {
              log.error("Error while selecting entry node", e);
              log.verbose("Retrying to select entry node, attempt:", attempt);
            },
          }
        );
      } catch (error) {
        log.error("Couldn't find new entry node: ", error);
        this.setDeadlock(DEADLOCK_MS);
      } finally {
        this.selectingEntryNode = false;
      }
    }

    // exclude entry node
    const eligibleExitNodes = this.exitNodes.filter(
      (node) => node.peerId !== this.entryNode?.peerId
    );
    const exitNode = utils.randomlySelectFromArray(eligibleExitNodes);
    return await Request.createRequest(
      this.crypto!,
      provider,
      body,
      this.entryNode!.peerId,
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
    }
    return now < this.deadlockTimestamp;
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

    // Check if SDK is deadlocked
    if (this.isDeadlocked()) {
      throw Error("SDK is deadlocked");
    }

    return new Promise(async (resolve, reject) => {
      const message = req.toMessage();
      const segments = message.toSegments();

      if (segments.length > MAXIMUM_SEGMENTS_PER_REQUEST) {
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
        return hoprd.sendMessage({
          apiEndpoint: this.entryNode!.apiEndpoint,
          apiToken: this.entryNode!.apiToken,
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
        log.error("failed to send message to hoprd", e);
        this.handleFailedRequest(req, e);
      }
    });
  }
}
