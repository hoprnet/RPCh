import type { Segment } from "./segment";

export type Cache = Map<number, Entry>; // requestId -> segmentNr -> Segment

export type Entry = {
  segments: Map<number, Segment>;
  count: number; // count segments manually to avoid iterating whole map
};

export function init(): Cache {
  return new Map();
}

/**
 * Handles incoming segments against the cache.
 * Remove complete segments and adds incomplete ones.
 */
export function incoming(cache: Cache, segment: Segment) {
  // handle invalid segment
  if (segment.totalCount <= 0) {
    return { res: "error", reason: "invalid totalCount" };
  }

  // handle single part segment without cache
  if (segment.totalCount === 1) {
    return {
      res: "complete",
      entry: {
        segments: new Map([[segment.nr, segment]]),
        count: 1,
      },
    };
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
      cache.delete(segment.requestId);
      return { res: "complete", entry };
    }

    return { res: "inserted" };
  }

  // creating new entry
  const entry = {
    segments: new Map([[segment.nr, segment]]),
    count: 1,
  };
  cache.set(segment.requestId, entry);
  return { res: "inserted" };
}

/**
 * Convert segments **Entry** to message body.
 *
 */
export function toMessage({ segments, count }: Entry) {
  let i = 0;
  let res = "";
  while (i < count) {
    res += segments.get(i)!.body;
    i++;
  }
  return res;
}

/**
 * Remove everything related to request id.
 *
 */
export function remove(cache: Cache, requestId: number) {
  cache.delete(requestId);
}
