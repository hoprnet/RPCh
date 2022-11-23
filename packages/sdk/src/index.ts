import { Cache, hoprd, Request, Response, Segment, utils } from "rpch-commons";
import RequestCache from "./request-cache";

const { sendMessage, createMessageListener } = hoprd;
const { createLogger } = utils;
const { log, logError } = createLogger();
const MOCK_DISCOVERY_PLATFORM_API_ENDPOINT = "https://localhost:3000";
const MOCK_API_TOKEN = "123456789";
const MOCK_DESTINATION =
  "16Uiu2HAmM9KAPaXA4eAz58Q7Eb3LEkDvLarU4utkyL6vM5mwDeEK";
const TIMEOUT = 60e3;

/**
 * Send traffic through the RPCh network
 */
export default class SDK {
  private cache: Cache;
  private requestCache: RequestCache;

  constructor() {
    this.requestCache = new RequestCache(TIMEOUT);
    this.cache = new Cache(
      TIMEOUT,
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
    apiEndpoint: string,
    apiToken: string
  ) {
    // get api token access
    // open listener
    await createMessageListener(
      MOCK_DISCOVERY_PLATFORM_API_ENDPOINT,
      MOCK_API_TOKEN,
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
          apiEndpoint: MOCK_DISCOVERY_PLATFORM_API_ENDPOINT,
          apiToken: MOCK_API_TOKEN,
          message: segment.toString(),
          destination: MOCK_DESTINATION,
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
