import {
  Cache as SegmentCache,
  Request,
  Response,
  Segment,
  hoprd,
  utils,
} from "rpch-common";
import ReliabilityScore from "./reliability-score";
import RequestCache from "./request-cache";

const { log, logError } = utils.createLogger(["sdk"]);
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
  private exitNodes: string[] = [];
  // selected entry node
  private entryNode?: EntryNode;
  // selected exit node
  private exitNodePeerId?: string;
  // stopMessageListener
  private stopMessageListener?: () => void;

  constructor(
    private readonly timeout: number,
    private readonly tempOps: HoprSdkTempOps
  ) {
    this.discoveryPlatformApiEndpoint = tempOps.discoveryPlatformApiEndpoint;

    this.segmentCache = new SegmentCache(
      (req: Request) => this.onRequestFromSegments(req),
      (res: Response) => this.onResponseFromSegments(res)
    );
    this.requestCache = new RequestCache(this.onRequestRemoval);
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
  ): Promise<string[]> {
    // requests the list of exit nodes (sometimes hit cache)
    // response gives back list of exit nodes
    // select exit node at random
    this.exitNodes = [this.tempOps.exitNodePeerId];
    this.exitNodePeerId = this.tempOps.exitNodePeerId;
    return this.exitNodes;
  }

  /**
   * Resolve request promise and delete the request from map
   * @param res Response received from cache module
   */
  private onResponseFromSegments(res: Response): void {
    const matchingRequest = this.requestCache.getRequest(res.id);
    if (!matchingRequest) {
      logError("matching request not found", res.id);
      return;
    }
    matchingRequest.resolve(res);

    this.reliabilityScore.addMetric(
      this.tempOps.entryNodePeerId,
      matchingRequest.request.id,
      "success"
    );
    this.requestCache.removeRequest(matchingRequest.request);
    log("responded to %s with %s", matchingRequest.request.body, res.body);
  }

  /**
   * Logs the request received from cache module
   * @param req Request received from cache module
   */
  private onRequestFromSegments(req: Request): void {
    log("ignoring received request %s", req.body);
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
          log(
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
    return Request.fromData(this.entryNode!.peerId, provider, body);
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
