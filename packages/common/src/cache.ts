import Request from "./request";
import Response from "./response";
import Message from "./message";
import Segment, { validateSegments } from "./segment";
import { createLogger, isExpired } from "./utils";

const { log, logVerbose } = createLogger("cache");

/**
 * Caches incoming segments.
 */
export default class Cache {
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
    private onRequest: (request: Request) => void,
    private onResponse: (response: Response) => void
  ) {}

  public onSegment(segment: Segment): void {
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
        this.onRequest(req);
      } catch {
        const res = Response.fromMessage(message);
        this.onResponse(res);
      }

      // remove segments
      this.segments.delete(segment.msgId);
    }
  }

  public removeExpired(): void {
    const now = new Date();

    logVerbose("segments", this.segments.size);

    for (const [id, entry] of this.segments.entries()) {
      if (isExpired(this.timeout, now, entry.receivedAt)) {
        log("dropping expired partial segments");
        this.segments.delete(id);
      }
    }
  }
}
