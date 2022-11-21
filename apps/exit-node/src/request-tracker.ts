/**
 * Responsible for keeping track of all requests received.
 */
import { Request, Response } from "rpch-commons";
import { utils } from "rpch-commons";
const { createLogger, isExpired } = utils;

const { log, logVerbose, logError } = createLogger("exit");

/**
 * Keep track of requests made.
 */
export default class RequestTracker {
  private requests = new Map<number, { request: Request; receivedAt: Date }>();
  public requestsReceived: number = 0;
  constructor(private timeout: number) {}

  /**
   * Adds the received request to the existing ones.
   * @param request that was received.
   */
  public onRequest(request: Request) {
    this.requests.set(request.id, { request, receivedAt: new Date() });
    ++this.requestsReceived;
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

  public setInterval(timeout: number) {
    this.timeout = timeout;
  }

  /**
   * Checks for requests where the received time is greater that the timeout
   */
  public removeExpired(): void {
    const now = new Date();

    logVerbose(" Number of requests", this.requests.size);

    for (const [id, entry] of this.requests.entries()) {
      log(isExpired(this.timeout, now, entry.receivedAt));
      if (isExpired(this.timeout, now, entry.receivedAt)) {
        log("Request %s timed out. Deleting", id);
        this.requests.delete(id);
      }
    }
  }
}
