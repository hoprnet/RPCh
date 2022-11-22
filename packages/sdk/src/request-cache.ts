import { Cache as SegmentsCache, Request, Response, utils } from "rpch-commons";
const { isExpired } = utils;
const { log, logVerbose, logError } = utils.createLogger("request-cache");

/**
 * Keeps in cache the Requests which have been sent by the SDK.
 * As soon as the upstream class finds a matching Response, it will remove the Request from the Request Cache.
 * @param timeout how often should tangling Requests be discarded in ms
 */
export default class RequestCache {
  // requests we have made to another relay, keyed by message.id
  private requests = new Map<
    number,
    {
      request: Request;
      createdAt: Date;
      resolve: (value: Response | PromiseLike<Response>) => void;
      reject: (reason?: any) => void;
    }
  >();

  constructor(private timeout: number) {}

  /**
   * Add Request to requests map
   * @param req
   * @param resolve resolve executor that is ran when the response is received
   * @param reject rejects the promise when the request runs into a timeout
   */
  public addRequest(
    req: Request,
    resolve: (value: Response | PromiseLike<Response>) => void,
    reject: (reason?: any) => void
  ): void {
    this.requests.set(req.id, {
      request: req,
      createdAt: new Date(),
      resolve,
      reject,
    });
  }

  public getRequest(key: number) {
    return this.requests.get(key);
  }

  /**
   * Remove request from requests map
   * @param req
   */
  public removeRequest(req: Request): void {
    this.requests.delete(req.id);
  }

  /**
   * Resolve request promise and delete the request from map
   * @param res Response received from cache module
   */
  public onResponseFromSegments(res: Response): void {
    const matchingRequest = this.requests.get(res.id);
    if (!matchingRequest) {
      logError("matching request not found", res.id);
      return;
    }
    matchingRequest.resolve(res);
    this.requests.delete(res.id);
    log("responded to %s with %s", matchingRequest.request.body, res.body);
  }

  /**
   * Logs the request received from cache module
   * @param req Request received from cache module
   */
  public onRequestFromSegments(req: Request): void {
    log("received request %s", req.body);
  }

  /**
   * Check every “timeout” for expired Requests
   */
  public setInterval(): void {
    setInterval(() => {
      for (const [key, value] of this.requests.entries()) {
        const timeNow = new Date();
        if (isExpired(this.timeout, timeNow, value.createdAt)) {
          this.requests.get(key)?.reject("Request timed out");
          this.requests.delete(key);
        }
      }
    }, this.timeout);
  }
}
