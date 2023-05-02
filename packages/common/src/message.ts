import Segment from "./segment";
import { splitStrByBytes, MAX_BYTES } from "./utils";

/**
 * Represents a message.
 * Which can be turned into segments and send over the HOPR network.
 */
export default class Message {
  constructor(public readonly id: number, public readonly body: string) {}

  public static fromSegments(segments: Segment[]): Message {
    if (segments.length === 0) {
      throw Error("Failed to construct Message: segments of length 0");
    }

    const { msgId, segmentsLength } = segments[0];
    if (segmentsLength !== segments.length) {
      throw Error("Failed to construct Message: missing segments");
    }
    if (!segments.every((s) => s.msgId === msgId)) {
      throw Error(
        "Failed to construct Message: one of the segments are not from the same message"
      );
    }

    const body = segments
      // sort segments by ASC
      .sort((a, b) => {
        return a.segmentNr - b.segmentNr;
      })
      // concatinate body
      .reduce((result, segment) => {
        return result + segment.body;
      }, "");

    return new Message(msgId, body);
  }

  public toSegments(): Segment[] {
    const bodies = splitStrByBytes(
      this.body,
      MAX_BYTES - Segment.MAX_SIZE_WITHOUT_BODY
    );
    if (!bodies) return [];
    return bodies.map(
      (body, index) => new Segment(this.id, index, bodies.length, body)
    );
  }
}
