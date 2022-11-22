import assert from "assert";
import Cache from "./cache";
import { PEER_ID_A, PROVIDER, RPC_REQ_LARGE } from "./fixtures";
import Request from "./request";
import Response from "./response";

const ID = 828161;
const RESPONSE = "response";

const fakeRequest = new Request(ID, PEER_ID_A, PROVIDER, RPC_REQ_LARGE);
const fakeRequestSegments = fakeRequest.toMessage().toSegments();

const fakeResponse = new Response(ID, RESPONSE);
const fakeResponseSegments = fakeResponse.toMessage().toSegments();

// why anonymous function?
describe("test Cache class", function () {
  it("should reconstruct request message", () => {
    const cache = new Cache(60e3, (request) => {
      assert.equal(request.toMessage().body, fakeRequest.toMessage().body);
    }, console.log);
    for (const segment of fakeRequestSegments) {
      cache.onSegment(segment);
    }
  })
  it("should reconstruct response message", () => {
    const cache = new Cache(60e3, console.log, (response) => {
      assert.equal(response.body, RESPONSE);
    });
    for (const segment of fakeResponseSegments) {
      cache.onSegment(segment);
    }
  })
  it("should drop duplicate segments", () => {
    const cache = new Cache(60e3, () => { }, () => { });
    // @ts-ignore-next-line
    const segments = cache.segments;
    console.log('@segments: ', segments);

    for (const segment of fakeRequestSegments) {
      cache.onSegment(segment);
    }

    const currentSegment = segments.get(828161);
    segments.set(828161, { segments: [...currentSegment!.segments], receivedAt: new Date(1669083639349) });

    cache.removeExpired();

  })
})

