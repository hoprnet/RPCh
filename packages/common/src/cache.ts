import Message from "./message";
import Segment from "./segment";
import { createLogger, isExpired, areAllSegmentsPresent } from "./utils";

const log = createLogger(["cache"]);

/**
 * A cache class which you can feed feed incoming Segments
 * and it will trigger back found Messages.
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

  /**
   *
   * @param onMessage Triggered once a Message can be constructed
   * @param onMessage Triggered once a Message has expired
   */
  constructor(
    private onMessage: (message: Message) => void,
    private onExpire?: () => void
  ) {}

  /**
   * Feeds the cache with a new segment.
   * If segment completed a set of segments
   * it will trigger `onMessage` function.
   * @param segment
   */
  public onSegment(segment: Segment): void {
    // get segment entry with matching msgId, or create a new one
    const segmentEntry = this.segments.get(segment.msgId) || {
      segments: [],
      receivedAt: new Date(),
    };

    if (segmentEntry.segments.find((s) => s.segmentNr === segment.segmentNr)) {
      log.verbose(
        "dropping segment, already exists",
        segment.msgId,
        segment.segmentNr
      );
      return;
    }

    segmentEntry.segments = [...segmentEntry.segments, segment];
    this.segments.set(segment.msgId, segmentEntry);
    log.verbose("stored new segment for message ID", segment.msgId);

    if (areAllSegmentsPresent(segmentEntry.segments)) {
      const message = Message.fromSegments(segmentEntry.segments);

      // remove segments
      this.segments.delete(segment.msgId);

      // trigger onMessage
      this.onMessage(message);
      log.verbose("found new Message", message.id);
    }
  }

  /**
   * Given a timeout, removes expired segments.
   * @param timeout How many ms after a segment was received.
   */
  public removeExpired(timeout: number): void {
    const now = new Date();

    log.verbose("total number of segments", this.segments.size);

    for (const [id, entry] of this.segments.entries()) {
      if (isExpired(timeout, now, entry.receivedAt)) {
        log.verbose("dropping expired partial segments");
        if (this.onExpire) {
          this.onExpire();
        }
        this.segments.delete(id);
      }
    }
  }
}
