import assert from "assert";
import Cache from "./cache";
import Request from "./request";
import Response from "./response";
import { PEER_ID_A, PROVIDER, RPC_REQ_LARGE } from "./fixtures";

const ID = 828161;
const RESPONSE = "response";

const fakeRequest = new Request(ID, PEER_ID_A, PROVIDER, RPC_REQ_LARGE);
const fakeRequestSegments = fakeRequest.toMessage().toSegments();

const fakeResponse = new Response(ID, RESPONSE);
const fakeResponseSegments = fakeResponse.toMessage().toSegments();

describe("test Cache class", function () {
  it("should reconstruct request message", function () {
    const cache = new Cache(
      10e3,
      (request) => {
        assert.equal(request.toMessage().body, fakeRequest.toMessage().body);
      },
      () => {}
    );

    for (const segment of fakeRequestSegments) {
      cache.onSegment(segment);
    }

    // check size of maps && length of segments.
    //@ts-ignore-next-line
    const request = cache.segments;
    assert.equal(request.size, 0);
    assert.equal(request.get(ID)?.segments, undefined);
  });
  it("should reconstruct response message", function () {
    const cache = new Cache(
      10e3,
      () => {},
      (response) => {
        assert.equal(response.body, RESPONSE);
      }
    );
    for (const segment of fakeResponseSegments) {
      cache.onSegment(segment);
    }

    // check size of maps && length of segments.
    //@ts-ignore-next-line
    const request = cache.segments;
    assert.equal(request.size, 0);
    assert.equal(request.get(ID)?.segments, undefined);
  });
  it("should drop expired segments", function () {
    jest.useFakeTimers();
    const cache = new Cache(
      10e3,
      () => {},
      () => {}
    );

    // simulate failure.
    for (const segment of fakeRequestSegments.slice(0, 2)) {
      cache.onSegment(segment);
    }

    // @ts-ignore-next-line
    const request = cache.segments;

    // advance time by 1s more than the timeout.
    jest.advanceTimersByTime(10e3 + 1e3);

    assert.equal(request.get(ID)?.segments?.length, 2);
    cache.removeExpired();
    assert.equal(request.get(ID)?.segments?.length, undefined);

    jest.useRealTimers();
  });
});
