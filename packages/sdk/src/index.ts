import {
  Cache as SegmentCache,
  Message,
  Request,
  Response,
  Segment,
  hoprd,
} from "@rpch/common";
import { Identity } from "@rpch/crypto-bridge/nodejs";
import { utils as etherUtils } from "ethers";
import ReliabilityScore from "./reliability-score";
import RequestCache from "./request-cache";
import { createLogger } from "./utils";

const log = createLogger();
/**
 * Temporary options to be passed to
 * the SDK for development purposes.
 */
export type HoprSdkTempOps = {
  discoveryPlatformApiEndpoint: string;
  entryNodeApiEndpoint: string;
  entryNodeApiToken: string;
  entryNodePeerId: string;
  exitNodePeerId: string;
  exitNodePubKey: string;
  freshNodeThreshold: number;
  maxResponses: number;
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
 * Send traffic through the RPCh network
 */
export default class SDK {
  // single inverval for the SDK for things that need to be checked.
  private interval?: NodeJS.Timer;
  private segmentCache: SegmentCache;
  private requestCache: RequestCache;
  private reliabilityScore: ReliabilityScore;
  // this will be static but right now passed via tempOps
  private discoveryPlatformApiEndpoint: string;
  // available exit nodes
  private exitNodes: { destination: string; pubKey: string }[] = [];
  // selected entry node
  private entryNode?: EntryNode;
  // selected exit node
  private exitNodePeerId?: string;
  private exitNodePubKey?: string;
  // stopMessageListener
  private stopMessageListener?: () => void;

  constructor(
    private readonly timeout: number,
    private readonly tempOps: HoprSdkTempOps,
    private setKeyVal: (key: string, val: string) => Promise<any>,
    private getKeyVal: (key: string) => Promise<string | undefined>
  ) {
    this.discoveryPlatformApiEndpoint = tempOps.discoveryPlatformApiEndpoint;
    this.segmentCache = new SegmentCache((message) => this.onMessage(message));
    this.requestCache = new RequestCache((request) =>
      this.onRequestRemoval(request)
    );
    this.reliabilityScore = new ReliabilityScore(
      tempOps.freshNodeThreshold,
      tempOps.maxResponses
    );
  }

  /**
   * @return true if SDK is ready to send requests
   */
  public get isReady(): boolean {
    return (
      !!this.entryNode && this.exitNodes.length > 0 && !!this.exitNodePeerId
    );
  }

  /**
   * Requests the Discovery Platform for an Entry Node.
   * @param discoveryPlatformApiEndpoint
   * @return entry node details
   */
  private async selectEntryNode(discoveryPlatformApiEndpoint: string): Promise<{
    apiEndpoint: string;
    apiToken: string;
    peerId: string;
  }> {
    // requests access to an entry node
    // response gives entry node details back
    this.entryNode = {
      apiEndpoint: this.tempOps.entryNodeApiEndpoint,
      apiToken: this.tempOps.entryNodeApiToken,
      peerId: this.tempOps.entryNodePeerId,
    };
    return this.entryNode;
  }

  /**
   * Updates exit node list from the Discovery Platform
   * @param discoveryPlatformApiEndpoint
   * @returns list of exit nodes
   */
  private async selectExitNode(
    discoveryPlatformApiEndpoint: string
  ): Promise<{ destination: string; pubKey: string }[]> {
    // requests the list of exit nodes (sometimes hit cache)
    // response gives back list of exit nodes
    // select exit node at random
    this.exitNodes = [
      {
        destination: this.tempOps.exitNodePeerId,
        pubKey: this.tempOps.exitNodePubKey,
      },
    ];
    this.exitNodePeerId = this.tempOps.exitNodePeerId;
    this.exitNodePubKey = this.tempOps.exitNodePubKey;
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
      log.error(
        "matching request not found",
        message.id,
        log.createMetric({ id: message.id })
      );
      return;
    }

    const counter = await this.getKeyVal(
      match.request.exitNodeDestination
    ).then((k) => BigInt(k || "0"));

    // construct Response from Message
    const response = Response.fromMessage(
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
      responseTime,
      log.createMetric({
        id: match.request.id,
        responseTime: responseTime,
      })
    );

    match.resolve(response);
    this.reliabilityScore.addMetric(
      this.tempOps.entryNodePeerId,
      match.request.id,
      "success"
    );
    this.requestCache.removeRequest(match.request);

    log.verbose("responded to %s with %s", match.request.body, response.body);
  }

  /**
   * Adds a failed metric to the reliability score
   * when the request expires.
   * @param req Request received from cache module.
   */
  private onRequestRemoval(req: Request): void {
    this.reliabilityScore.addMetric(
      this.tempOps.entryNodePeerId,
      req.id,
      "failed"
    );
    log.normal("request %s expired", req.id);
  }

  /**
   * Start the SDK and initialize necessary data.
   */
  public async start(): Promise<void> {
    if (this.isReady) return;
    // check for expires caches every second
    this.interval = setInterval(() => {
      this.segmentCache.removeExpired(this.timeout);
      this.requestCache.removeExpired(this.timeout);
    }, 1e3);

    await this.selectEntryNode(this.discoveryPlatformApiEndpoint);
    await this.selectExitNode(this.discoveryPlatformApiEndpoint);
    this.stopMessageListener = await hoprd.createMessageListener(
      this.entryNode!.apiEndpoint,
      this.entryNode!.apiToken,
      (message) => {
        try {
          const segment = Segment.fromString(message);
          this.segmentCache.onSegment(segment);
        } catch (e) {
          log.normal(
            "rejected received data from HOPRd: not a valid segment",
            message,
            e
          );
        }
      }
    );
  }

  /**
   * Stop the SDK and clear up tangling processes.
   */
  public async stop(): Promise<void> {
    if (this.stopMessageListener) this.stopMessageListener();
    clearInterval(this.interval);
  }

  /**
   * Creates a Request instance that can be sent through the RPCh network
   * @param origin
   * @param provider
   * @param body
   * @returns Request
   */
  public createRequest(provider: string, body: string): Request {
    if (!this.isReady) throw Error("SDK not ready to create requests");
    return Request.createRequest(
      provider,
      body,
      this.entryNode!.peerId,
      this.exitNodePeerId!,
      Identity.load_identity(etherUtils.arrayify(this.exitNodePubKey!))
    );
  }

  /**
   * Sends a Request through the RPCh network
   * @param req Request
   * @returns Promise<Response>
   */
  public sendRequest(req: Request): Promise<Response> {
    if (!this.isReady) throw Error("SDK not ready to send requests");

    return new Promise((resolve, reject) => {
      const message = req.toMessage();
      const segments = message.toSegments();
      this.requestCache.addRequest(req, resolve, reject);
      for (const segment of segments) {
        hoprd.sendMessage({
          apiEndpoint: this.entryNode!.apiEndpoint,
          apiToken: this.entryNode!.apiToken,
          message: segment.toString(),
          destination: this.exitNodePeerId!,
        });
      }
    });
  }
}
