import {
  Cache as CommonSegmentCache,
  Segment as CommonSegment,
} from "@rpch/common";
import * as SegmentCache from "./segment-cache";
import * as Segment from "./segment";
import segments5000 from "./segment_perf_5000";

describe("test performance of incoming messages", function () {
  it("running old segment cache first", function () {
    const scOld = new CommonSegmentCache(
      function () {},
      function () {}
    );
    const ts = performance.now();
    segments5000.forEach(function (s: string) {
      const segment = CommonSegment.fromString(s);
      scOld.onSegment(segment);
    });
    const later = performance.now();
    const diff = later - ts;
    expect(later).toBeGreaterThan(ts);

    const scNew = SegmentCache.init();
    const ts2 = performance.now();
    segments5000.forEach(function (s: string) {
      const res1 = Segment.fromString(s);
      // @ts-ignore
      const res2 = SegmentCache.incoming(scNew, res1.segment);
      if (res2.res === "complete") {
        // @ts-ignore
        SegmentCache.toMessage(res2.segments);
      }
    });
    const later2 = performance.now();
    const diff2 = later2 - ts2;
    expect(later2).toBeGreaterThan(ts2);
    expect(diff2).toBeLessThan(diff);
  });

  it("running new segment cache first", function () {
    const scNew = SegmentCache.init();
    const ts2 = performance.now();
    segments5000.forEach(function (s: string) {
      const res1 = Segment.fromString(s);
      // @ts-ignore
      const res2 = SegmentCache.incoming(scNew, res1.segment);
      if (res2.res === "complete") {
        // @ts-ignore
        SegmentCache.toMessage(res2.segments);
      }
    });
    const later2 = performance.now();
    const diff2 = later2 - ts2;
    expect(later2).toBeGreaterThan(ts2);

    const scOld = new CommonSegmentCache(
      function () {},
      function () {}
    );
    const ts = performance.now();
    segments5000.forEach(function (s: string) {
      const segment = CommonSegment.fromString(s);
      scOld.onSegment(segment);
    });
    const later = performance.now();
    const diff = later - ts;
    expect(later).toBeGreaterThan(ts);
    expect(diff2).toBeLessThan(diff);
  });
});
