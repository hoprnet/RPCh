import { utils } from "@rpch/common";

export type Segment = {
  requestId: number;
  nr: number;
  totalCount: number;
  body: string;
};

export function fromString(str: string): Segment {
  const [msgId_, segmentNr_, segmentsLength_, body] =
    utils.splitBodyToParts(str);

  const msgId = Number(msgId_);
  const segmentNr = Number(segmentNr_);
  const segmentsLength = Number(segmentsLength_);
  return {
    requestId: msgId,
    nr: segmentNr,
    totalCount: segmentsLength,
    body,
  };
}
