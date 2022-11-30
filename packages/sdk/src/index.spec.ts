import assert from "assert";
import nock from "nock";
import { Request, fixtures } from "rpch-common";
import SDK from "./index";

const TIMEOUT = 10e3;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_TOKEN = "12345";
const ENTRY_NODE_PEER_ID = fixtures.PEER_ID_A;
const EXIT_NODE_PEER_ID = fixtures.PEER_ID_B;

describe("test SDK class", function () {
  let sdk: SDK;

  nock(ENTRY_NODE_API_ENDPOINT).persist().post(/.*/).reply(202, "someresponse");

  beforeEach(function () {
    sdk = new SDK(TIMEOUT, {
      discoveryPlatformApiEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
      entryNodeApiEndpoint: ENTRY_NODE_API_ENDPOINT,
      entryNodeApiToken: ENTRY_NODE_API_TOKEN,
      entryNodePeerId: ENTRY_NODE_PEER_ID,
      exitNodePeerId: EXIT_NODE_PEER_ID,
    });
  });

  afterEach(function () {
    sdk.stop();
  });

  it("should fail to create request", function () {
    assert.throws(() => {
      return sdk.createRequest(fixtures.PROVIDER, fixtures.RPC_REQ_LARGE);
    }, "not ready");
  });

  it("should fail to send request", function () {
    assert.throws(() => {
      return sdk.sendRequest(fixtures.LARGE_REQUEST);
    }, "not ready");
  });

  it("should create request", async function () {
    await sdk.start();
    const request = sdk.createRequest(
      fixtures.PROVIDER,
      fixtures.RPC_REQ_LARGE
    );
    assert(request instanceof Request);
    assert.equal(request.origin, ENTRY_NODE_PEER_ID);
    assert.equal(request.provider, fixtures.PROVIDER);
    assert.equal(request.body, fixtures.RPC_REQ_LARGE);
  });

  it("should send request and return response", function (done) {
    sdk.start().then(() => {
      sdk.sendRequest(fixtures.LARGE_REQUEST).then((response) => {
        assert.equal(response.id, fixtures.LARGE_RESPONSE.id);
        // @ts-ignore
        const pendingRequest = sdk.requestCache.getRequest(
          fixtures.LARGE_RESPONSE.id
        );
        assert.equal(pendingRequest, undefined);
        done();
      });

      // @ts-ignore
      sdk.onResponseFromSegments(fixtures.LARGE_RESPONSE);
    });
  });

  describe("should handle requests correctly when receiving a response", function () {
    beforeAll(async function () {
      await sdk.start();
    });

    it("should remove request with matching response", function () {
      // @ts-ignore
      sdk.requestCache.addRequest(
        fixtures.LARGE_REQUEST,
        () => {},
        () => {}
      );
      // @ts-ignore
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
      // @ts-ignore
      sdk.onResponseFromSegments(fixtures.SMALL_RESPONSE);
      assert.equal(
        // @ts-ignore
        sdk.requestCache.getRequest(fixtures.LARGE_RESPONSE.id)?.request.id,
        fixtures.LARGE_REQUEST.id
      );
    });
  });
});
