/**
 * Responsible for keeping track of all requests received.
 */
import { Request, Response, utils } from "rpch-commons";
const { createLogger, isExpired } = utils;

const { log, logError } = createLogger("exit");

/**
 * Keep track of requests made.
 */
export default class RequestTracker {
  private requests = new Map<number, { request: Request; receivedAt: Date }>();
  constructor(private timeout: number) {}

  /**
   * Adds the received request to the existing ones.
   * @param request that was received.
   */
  public onRequest(request: Request) {
    this.requests.set(request.id, { request, receivedAt: new Date() });
  }

  /**
   * Delete the request that was resolved from the existing requests
   * @param response received from the provider.
   */
  public onResponse(response: Response): void {
    const requestEntry = this.requests.get(response.id);
    if (!requestEntry) {
      logError("Matching request not found", response.id);
      return;
    }
    this.requests.delete(response.id);
    log("Responded to %s with %s", requestEntry.request.body, response.body);
  }

  public getRequest(id: number) {
    return this.requests.get(id);
  }

  /**
   * Check every “timeout” for expired Requests
   */
  public setInterval(): NodeJS.Timer {
    return setInterval(() => {
      for (const [key, value] of this.requests.entries()) {
        const timeNow = new Date();
        log(isExpired(this.timeout, timeNow, value.receivedAt));
        if (isExpired(this.timeout, timeNow, value.receivedAt)) {
          log("Request %s timed out. Deleting", key);
          this.requests.delete(key);
        }
      }
    }, this.timeout);
  }
}
