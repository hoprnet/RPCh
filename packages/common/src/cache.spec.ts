import assert from "assert";
import Cache from "./cache";
import {
  LARGE_REQUEST as REQUEST,
  LARGE_RESPONSE as RESPONSE,
} from "./fixtures";

const TIMEOUT = 10e3;
const REQUEST_SEGMENTS = REQUEST.toMessage().toSegments();
const RESPONSE_SEGMENTS = RESPONSE.toMessage().toSegments();

describe("test Cache class", function () {
  it("should reconstruct request message", function (done) {
    const cache = new Cache(
      TIMEOUT,
      (request) => {
        assert.equal(request.body, REQUEST.body);

        // check size of maps && length of segments
        //@ts-ignore-next-line
        const requestInCache = cache.segments;
        assert.equal(requestInCache.size, 0);
        assert.equal(requestInCache.get(REQUEST.id)?.segments, undefined);

        done();
      },
      () => {}
    );

    for (const segment of REQUEST_SEGMENTS) {
      cache.onSegment(segment);
    }
  });
  it("should reconstruct response message", function (done) {
    const cache = new Cache(
      TIMEOUT,
      () => {},
      (response) => {
        assert.equal(response.body, RESPONSE.body);

        // check size of maps && length of segments
        //@ts-ignore-next-line
        const request = cache.segments;
        assert.equal(request.size, 0);
        assert.equal(request.get(RESPONSE.id)?.segments, undefined);

        done();
      }
    );
    for (const segment of RESPONSE_SEGMENTS) {
      cache.onSegment(segment);
    }
  });
  it("should drop expired segments", function () {
    jest.useFakeTimers();
    const cache = new Cache(
      TIMEOUT,
      () => {},
      () => {}
    );

    // simulate failure.
    for (const segment of REQUEST_SEGMENTS.slice(0, 2)) {
      cache.onSegment(segment);
    }

    // @ts-ignore-next-line
    const requestInCache = cache.segments;

    // advance time by 1s more than the timeout.
    jest.advanceTimersByTime(TIMEOUT + 1e3);

    assert.equal(requestInCache.get(REQUEST.id)?.segments?.length, 2);
    cache.removeExpired();
    assert.equal(requestInCache.get(REQUEST.id)?.segments?.length, undefined);

    jest.useRealTimers();
  });
});
