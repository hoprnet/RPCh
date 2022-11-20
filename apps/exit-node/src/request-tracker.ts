/**
 * Responsible for keeping track of all requests received.
 */
import { Request, Response } from "rpch-commons";
import { utils } from "rpch-commons";
const { createLogger, isExpired } = utils;

const { log, logVerbose, logError } = createLogger("exit");

export default class RequestTracker {
  private requests = new Map<number, { request: Request; receivedAt: Date }>();
  public requestsReceived: number = 0;
  constructor(private timeout: number) {}

  public onRequest(request: Request) {
    this.requests.set(request.id, { request, receivedAt: new Date() });
    ++this.requestsReceived;
  }

  public onResponse(response: Response): void | undefined {
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
