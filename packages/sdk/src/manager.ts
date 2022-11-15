import type { ServerResponse } from "http";
import {
  Segment,
  Message,
  Request,
  Response,
  utils,
  validateSegments,
} from "rpch-commons";

const { log, logVerbose, logError } = utils.createLogger("manager");

let reqCreatedCount = 0;
let resReceivedCount = 0;

/**
 * Stores requests made and incoming segments.
 */
export class Manager {
  // requests we have made to another relay, keyed by message.id
  private requests = new Map<
    number,
    {
      request: Request;
      responseObj: ServerResponse;
      createdAt: Date;
    }
  >();

  // partial segments received, keyed by segment.msgId
  private segments = new Map<
    number,
    {
      segments: Segment[];
      receivedAt: Date;
    }
  >();

  constructor(
    private timeout: number,
    private sendMessageToHOPRd: (
      segment: Segment,
      destination: string
    ) => Promise<void>,
    private sendRequestToProvider: (
      request: Request,
      provider: string
    ) => Promise<string>
  ) {}

  /**
   * Break apart message to segments and sent it
   * over the HOPR network.
   * @param message
   * @param destination
   */
  private async sendMessage(
    message: Message,
    destination: string
  ): Promise<void> {
    for (const segment of message.toSegments()) {
      await this.sendMessageToHOPRd(segment, destination);
    }
  }

  /**
   * Create a reqeust and send it over
   * the HOPR network.
   * @param request
   * @param responseObj http response object
   * @param destination exit peer id
   */
  public async createRequest(
    request: Request,
    responseObj: ServerResponse,
    destination: string
  ): Promise<void> {
    logVerbose("requests created", ++reqCreatedCount);
    this.requests.set(request.id, {
      request,
      createdAt: new Date(),
      responseObj,
    });
    await this.sendMessage(request.toMessage(), destination);
  }

  public handleReceivedMessageResponse(response: Response): void {
    const requestEntry = this.requests.get(response.id);
    if (!requestEntry) {
      logError("matching request not found", response.id);
      return;
    }

    requestEntry.responseObj.write(response.body);
    requestEntry.responseObj.statusCode = 200;
    requestEntry.responseObj.end();
    this.requests.delete(response.id);
    logVerbose("responses received", ++resReceivedCount);
    log("responded to %s with %s", requestEntry.request.body, response.body);
  }

  public async handleReceivedMessageRequest(request: Request): Promise<void> {
    const response = await this.sendRequestToProvider(
      request,
      request.provider
    );
    await this.sendMessage(
      request.createResponse(response).toMessage(),
      request.origin
    );
  }

  public onSegmentReceived(segment: Segment): void {
    // get segment entry with matching msgId, or create a new one
    const segmentEntry = this.segments.get(segment.msgId) || {
      segments: [] as Segment[],
      receivedAt: new Date(),
    };

    if (segmentEntry.segments.find((s) => s.segmentNr === segment.segmentNr)) {
      log("dropping segment, already exists", segment.msgId, segment.segmentNr);
      return;
    }

    segmentEntry.segments = [...segmentEntry.segments, segment];
    this.segments.set(segment.msgId, segmentEntry);
    log("stored new segment");

    if (validateSegments(segmentEntry.segments)) {
      const message = Message.fromSegments(segmentEntry.segments);

      try {
        const req = Request.fromMessage(message);
        this.handleReceivedMessageRequest(req);
      } catch {
        const res = Response.fromMessage(message);
        this.handleReceivedMessageResponse(res);
      }

      // remove segments
      this.segments.delete(segment.msgId);
    }
  }

  public removeExpired(): void {
    const now = new Date();

    logVerbose("requests", this.requests.size);
    logVerbose("segments", this.segments.size);

    for (const [id, entry] of this.requests.entries()) {
      log(utils.isExpired(this.timeout, now, entry.createdAt));
      if (utils.isExpired(this.timeout, now, entry.createdAt)) {
        log("dropping expired request");
        this.requests.delete(id);
        entry.responseObj.statusCode = 400;
        entry.responseObj.end();
      }
    }

    for (const [id, entry] of this.segments.entries()) {
      if (utils.isExpired(this.timeout, now, entry.receivedAt)) {
        log("dropping expired partial segments");
        this.segments.delete(id);
      }
    }
  }
}
