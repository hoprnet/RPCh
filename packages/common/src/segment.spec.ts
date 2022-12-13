import assert from "assert";
import Segment from "./segment";

const BODY = "body";

describe("test Segment class", function () {
  it("should create segment", function () {
    const segment = new Segment(13, 0, 1, BODY);
    assert.equal(segment.msgId, 13);
    assert.equal(segment.segmentNr, 0);
    assert.equal(segment.segmentsLength, 1);
    assert.equal(segment.body, BODY);
  });
  it("should create segment from string", function () {
    const segment = Segment.fromString(`13|0|1|${BODY}`);
    assert.equal(segment.msgId, 13);
    assert.equal(segment.segmentNr, 0);
    assert.equal(segment.segmentsLength, 1);
    assert.equal(segment.body, BODY);
  });
  it("Should be a correct segment", function () {
    const segment = Segment.fromString(
      `621489|0|1|response|{"jsonrpc":"2.0","result":"0x64","id":42}`
    );
    console.log(segment);
    assert.equal(segment.msgId, 621489);
    assert.equal(segment.segmentNr, 0);
    assert.equal(segment.segmentsLength, 1);
    assert.equal(
      segment.body,
      `response|{"jsonrpc":"2.0","result":"0x64","id":42}`
    );
  });
});
