import { Cache as SegmentCache, Segment } from "@rpch/common";
import { empty, incoming } from "./segment_cache";
import * as NewSegment from "./segment";
import segments5000 from "./segments_5000";

describe("test performance of incoming messages", function () {
  it("running old segment cache first", function () {
    const scOld = new SegmentCache(
      function () {},
      function () {}
    );
    const ts = performance.now();
    segments5000.forEach(function (s: string) {
      const segment = Segment.fromString(s);
      scOld.onSegment(segment);
    });
    const later = performance.now();
    console.log("took old", later - ts, "ns");
    expect(later).toBeGreaterThan(ts);

    const scNew = empty();
    const ts2 = performance.now();
    segments5000.forEach(function (s: string) {
      const segment = NewSegment.fromString(s);
      incoming(scNew, segment);
    });
    const later2 = performance.now();
    console.log("took new", later2 - ts2, "ns");
    expect(later2).toBeGreaterThan(ts2);
  });

  it("running new segment cache first", function () {
    const scNew = empty();
    const ts2 = performance.now();
    segments5000.forEach(function (s: string) {
      const segment = NewSegment.fromString(s);
      incoming(scNew, segment);
    });
    const later2 = performance.now();
    console.log("took new", later2 - ts2, "ns");
    expect(later2).toBeGreaterThan(ts2);

    const scOld = new SegmentCache(
      function () {},
      function () {}
    );
    const ts = performance.now();
    segments5000.forEach(function (s: string) {
      const segment = Segment.fromString(s);
      scOld.onSegment(segment);
    });
    const later = performance.now();
    console.log("took old", later - ts, "ns");
    expect(later).toBeGreaterThan(ts);
  });
});
