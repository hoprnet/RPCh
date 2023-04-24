import assert from "assert";
import Cache from "./cache";
import { createMockedFlow } from "./fixtures";
import { req_80kb } from "./compression/compression-samples";

const TIMEOUT = 10e3;

describe("test Cache class", function () {
  it("should reconstruct message", async function () {
    const MESSAGE = (
      await createMockedFlow(JSON.stringify(req_80kb)).next()
    ).value.toMessage();
    const MESSAGE_SEGMENTS = MESSAGE.toSegments();

    const cache = new Cache((message) => {
      assert.equal(message.body, MESSAGE.body);

      // check size of maps && length of segments
      //@ts-ignore-next-line
      const inCache = cache.segments;
      assert.equal(inCache.size, 0);
      assert.equal(inCache.get(message.id)?.segments, undefined);

      //     done();
    });

    for (const segment of MESSAGE_SEGMENTS) {
      cache.onSegment(segment);
    }
  });
  it("should drop expired segments", async function () {
    const MESSAGE = (
      await createMockedFlow(JSON.stringify(req_80kb)).next()
    ).value.toMessage();
    const MESSAGE_SEGMENTS = MESSAGE.toSegments();

    jest.useFakeTimers();
    const cache = new Cache(() => {});

    // simulate failure.
    for (const segment of MESSAGE_SEGMENTS.slice(0, 2)) {
      cache.onSegment(segment);
    }

    // @ts-ignore-next-line
    const inCache = cache.segments;

    // advance time by 1s more than the timeout.
    jest.advanceTimersByTime(TIMEOUT + 1e3);

    assert.equal(inCache.get(MESSAGE.id)?.segments?.length, 2);
    cache.removeExpired(TIMEOUT);
    assert.equal(inCache.get(MESSAGE.id)?.segments?.length, undefined);

    jest.useRealTimers();
  });
});
