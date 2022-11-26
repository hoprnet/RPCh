import { Cache, Request, Response, Segment, hoprd, utils } from "rpch-common";
import RequestCache from "./request-cache";

const { sendMessage, createMessageListener } = hoprd;
const { createLogger } = utils;
const { log, logError } = createLogger();

/**
 * Send traffic through the RPCh network
 */
export default class SDK {
  private cache: Cache;
  private requestCache: RequestCache;

  constructor(
    private timeout: number,
    private discoveryPlatformApiEndpoint: string,
    private entryNodeApiEndpoint: string,
    private entryNodeApiToken: string,
    private exitNodePeerId: string
  ) {
    this.requestCache = new RequestCache(this.timeout);
    this.cache = new Cache(
      this.timeout,
      this.onRequestFromSegments,
      this.onResponseFromSegments
    );
  }

  /**
   * Requests messaging access token that will allow traffic to be sent
   * through the RPCh network
   * @param apiEndpoint Endpoint where access token will be requested
   * @param apiToken
   */
  public async requestMessagingAccessToken(
    _apiEndpoint: string,
    _apiToken: string
  ) {
    // get api token access
    // open listener
    await createMessageListener(
      this.entryNodeApiEndpoint,
      this.entryNodeApiToken,
      (message) => {
        try {
          const segment = Segment.fromString(message);
          this.cache.onSegment(segment);
        } catch (e) {
          log(
            "rejected received data from HOPRd: not a valid segment",
            message
          );
        }
      }
    );
    this.requestCache.setInterval();
  }

  /**
   * Creates a Request instance that can be sent through the RPCh network
   * @param origin
   * @param provider
   * @param body
   * @returns Request
   */
  public createRequest(
    origin: string,
    provider: string,
    body: string
  ): Request {
    return Request.fromData(origin, provider, body);
  }

  /**
   * Sends a Request through the RPCh network
   * @param req Request
   * @returns Promise<Response>
   */
  public sendRequest(req: Request): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      const message = req.toMessage();
      const segments = message.toSegments();
      this.requestCache.addRequest(req, resolve, reject);
      for (const segment of segments) {
        await sendMessage({
          apiEndpoint: this.entryNodeApiEndpoint,
          apiToken: this.entryNodeApiToken,
          message: segment.toString(),
          destination: this.exitNodePeerId,
        });
      }
    });
  }

  /**
   * Resolve request promise and delete the request from map
   * @param res Response received from cache module
   */
  public onResponseFromSegments(res: Response): void {
    const matchingRequest = this.requestCache.getRequest(res.id);
    if (!matchingRequest) {
      logError("matching request not found", res.id);
      return;
    }
    matchingRequest.resolve(res);
    this.requestCache.removeRequest(matchingRequest.request);
    log("responded to %s with %s", matchingRequest.request.body, res.body);
  }

  /**
   * Logs the request received from cache module
   * @param req Request received from cache module
   */
  public onRequestFromSegments(req: Request): void {
    log("received request %s", req.body);
  }
}
