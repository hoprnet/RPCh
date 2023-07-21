import type { Segment } from "segment";

export type Cache = Map<number, Entry>; // requestId -> segmentNr -> Segment

type Entry = {
  segments: Map<number, Segment>;
  count: number; // count entrie manually to avoid iterating through whole map
};

export function incoming(cache: Cache, segment: Segment) {
  // handle invalid segment
  if (segment.totalCount <= 0) {
    return { res: "error", reason: "invalid totalCount" };
  }

  // handle single part segment without cache
  if (segment.totalCount === 1) {
    return { res: "complete-no-cache", segments: [segment] };
  }

  // adding to existing segments
  if (cache.has(segment.requestId)) {
    const entry = cache.get(segment.requestId)!;
    // do nothing if already cached
    if (entry.segments.has(segment.nr)) {
      return { res: "already-cached" };
    }

    // insert segment
    entry.segments.set(segment.nr, segment);
    entry.count++;

    // check if we are completing
    if (segment.totalCount === entry.count) {
      const segments = Array.from(entry.segments.values());
      return { res: "complete", segments };
    }

    return { res: "inserted" };
  }

  // creating new entry
  const entry = {
    segments: new Map([segment.nr, segment]),
    count: 1,
  };
  cache.set(segment.requestId, entry);
  return { res: "inserted" };
}
