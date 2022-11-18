import Cache from "./cache";
import assert from "assert";
import { RPC_REQ_LARGE } from "./fixtures";
import Request from "./request";

const fakeRequest = new Request(1, "node", "prov", RPC_REQ_LARGE);
const fakeSegmets = fakeRequest.toMessage().toSegments();

// test onRequest
describe("test Cache class", function () {
  it("should reconstruct message", (done) => {
    const cache = new Cache(
      60e3,
      (request) => {
        assert.equal(request.toMessage().body, "hello");
        done();
      },
      console.log
    );
    for (const segment of fakeSegmets) {
      cache.onSegment(segment);
    }
  });
});

// test onResponse

// test onSegment

// test removeExpired
