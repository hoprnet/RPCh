import { Cache as SegmentCache, Segment } from "@rpch/common";
import segments5000 from "./segments_5000";

describe("test performance of incoming messages", function () {
  it("running segment cache first", function () {
    const ts = performance.now();
    const sc = new SegmentCache(
      function () {},
      function () {}
    );
    segments5000.forEach(function (s: string) {
      const segment = Segment.fromString(s);
      sc.onSegment(segment);
    });
    const later = performance.now();
    console.log("took", later - ts, "ns");
    expect(later).toBeGreaterThan(ts);
  });
});
