import { utils } from "ethers";
import { joinPartsToBody, splitBodyToParts } from "./utils";

/**
 * Represents a segment of a message.
 * This is what we send over the HOPR network.
 */
export default class Segment {
  constructor(
    public readonly msgId: number,
    public readonly segmentNr: number,
    public readonly segmentsLength: number,
    public readonly body: string
  ) {
    if (
      isNaN(msgId) ||
      isNaN(segmentNr) ||
      isNaN(segmentsLength) ||
      typeof body !== "string"
    ) {
      throw Error(`Failed to construct Segment`);
    }

    if (msgId > 999999 || segmentNr > 999 || segmentsLength > 999) {
      throw Error(
        `Failed to construct Segment: some segment parameters exceed max size`
      );
    }
  }

  public toString() {
    return joinPartsToBody([
      String(this.msgId),
      String(this.segmentNr),
      String(this.segmentsLength),
      this.body,
    ]);
  }

  public static get MAX_SIZE_WITHOUT_BODY(): number {
    return utils.toUtf8Bytes(new Segment(999999, 999, 999, "").toString())
      .byteLength;
  }

  public static fromString(str: string): Segment {
    const [msgId_, segmentNr_, segmentsLength_, body] = splitBodyToParts(str);

    const msgId = Number(msgId_);
    const segmentNr = Number(segmentNr_);
    const segmentsLength = Number(segmentsLength_);
    return new Segment(msgId, segmentNr, segmentsLength, body);
  }
}
