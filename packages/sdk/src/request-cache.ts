import { Request, Response, utils } from "@rpch/common";
import { createLogger } from "./utils";

const log = createLogger(["request-cache"]);

/**
 * Keeps in cache the Requests which have been sent by the SDK.
 * As soon as the upstream class finds a matching Response, it will remove the Request from the Request Cache.
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

  constructor(private onRequestRemoval: (req: Request) => void) {}

  /**
   * Add Request to requests map
   * @param req
   * @param resolve resolve executor that is ran when the response is received
   * @param reject rejects the promise when the request runs into a timeout
   */
  public addRequest(
    request: Request,
    resolve: (value: Response | PromiseLike<Response>) => void,
    reject: (reason?: any) => void
  ): void {
    this.requests.set(request.id, {
      request,
      createdAt: new Date(),
      resolve,
      reject,
    });
  }

  /**
   * Get a request from the request map
   * @param id of the request
   */
  public getRequest(id: number) {
    return this.requests.get(id);
  }

  /**
   * Remove request from requests map
   * @param req request to remove
   */
  public removeRequest(req: Request): void {
    this.requests.delete(req.id);
  }

  /**
   * Given a timeout, removes expired requests.
   * @param timeout How many ms after a Request was created.
   */
  public removeExpired(timeout: number): void {
    const now = new Date();

    log.verbose("requests", this.requests.size);
    for (const [key, entry] of this.requests.entries()) {
      if (utils.isExpired(timeout, now, entry.createdAt)) {
        entry.reject("Request timed out");
        this.onRequestRemoval(entry.request);
        this.requests.delete(key);
      }
    }
  }
}
