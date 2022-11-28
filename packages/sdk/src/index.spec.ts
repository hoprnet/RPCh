import assert from "assert";
import nock from "nock";
import { Request, fixtures } from "rpch-common";
import SDK from "./index";

const TIMEOUT = 10e3;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_TOKEN = "12345";
const ORIGIN = fixtures.PEER_ID_A;
const EXIT_NODE_PEER_ID = fixtures.PEER_ID_B;

describe("test SDK class", function () {
  let sdk: SDK;

  beforeEach(function () {
    sdk = new SDK(
      TIMEOUT,
      DISCOVERY_PLATFORM_API_ENDPOINT,
      ENTRY_NODE_API_ENDPOINT,
      ENTRY_NODE_API_TOKEN,
      EXIT_NODE_PEER_ID
    );
  });

  it("should create request", function () {
    const request = sdk.createRequest(
      ORIGIN,
      fixtures.PROVIDER,
      fixtures.RPC_REQ_LARGE
    );
    assert(request instanceof Request);
    assert.equal(request.origin, ORIGIN);
    assert.equal(request.provider, fixtures.PROVIDER);
    assert.equal(request.body, fixtures.RPC_REQ_LARGE);
  });
  it("should send request and return response", function (done) {
    nock(ENTRY_NODE_API_ENDPOINT)
      .persist()
      .post(/.*/)
      .reply(202, "someresponse");

    sdk.sendRequest(fixtures.LARGE_REQUEST).then((response) => {
      assert.equal(response.id, fixtures.LARGE_RESPONSE.id);
      // @ts-ignore
      const pendingRequest = sdk.requestCache.getRequest(
        fixtures.LARGE_RESPONSE.id
      );
      assert.equal(pendingRequest, undefined);
      done();
    });

    sdk.onResponseFromSegments(fixtures.LARGE_RESPONSE);
  });
  describe("should handle requests correctly when receiving a response", function () {
    it("should remove request with matching response", function () {
      // @ts-ignore
      sdk.requestCache.addRequest(
        fixtures.LARGE_REQUEST,
        () => {},
        () => {}
      );
      sdk.onResponseFromSegments(fixtures.LARGE_RESPONSE);
      assert.equal(
        // @ts-ignore
        sdk.requestCache.getRequest(fixtures.LARGE_RESPONSE.id),
        undefined
      );
    });
    it("shouldn't remove request with different response", function () {
      // @ts-ignore
      sdk.requestCache.addRequest(
        fixtures.LARGE_REQUEST,
        () => {},
        () => {}
      );
      sdk.onResponseFromSegments(fixtures.SMALL_RESPONSE);
      assert.equal(
        // @ts-ignore
        sdk.requestCache.getRequest(fixtures.LARGE_RESPONSE.id)?.request.id,
        fixtures.LARGE_REQUEST.id
      );
    });
  });
});
