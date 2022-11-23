import assert from "assert";
import nock from "nock";
import { Request, Response } from "rpch-commons";
import { fixtures } from "rpch-commons";
const {
  MOCK_DISCOVERY_PLATFORM_API_ENDPOINT,
  MOCK_RESPONSE_TEXT,
  PEER_ID_A: ORIGIN,
  PROVIDER,
  RPC_REQ_SMALL,
  REQUEST_A,
  RESPONSE_A,
  RESPONSE_B,
} = fixtures;
import SDK from "./index";

describe("test SDK class", function () {
  let sdk: SDK;
  beforeEach(() => {
    sdk = new SDK();
  });
  it("should create request", function () {
    const request = sdk.createRequest(ORIGIN, PROVIDER, RPC_REQ_SMALL);
    assert(request instanceof Request);
    assert.equal(request.origin, ORIGIN);
    assert.equal(request.provider, PROVIDER);
    assert.equal(request.body, RPC_REQ_SMALL);
  });
  it("should send request and return response", function (done) {
    nock(MOCK_DISCOVERY_PLATFORM_API_ENDPOINT)
      .post(/.*/)
      .reply(202, MOCK_RESPONSE_TEXT);

    sdk.sendRequest(REQUEST_A).then((value) => {
      assert.equal(value.id, REQUEST_A.id);
      // @ts-ignore
      const pendingRequest = sdk.requestCache.getRequest(RESPONSE_A.id);
      assert.equal(pendingRequest, undefined);
      done();
    });

    sdk.onResponseFromSegments(RESPONSE_A);
  });
  describe("should handle requests correctly when receiving a response", function () {
    it("should remove request with matching response", function () {
      // @ts-ignore
      sdk.requestCache.addRequest(
        REQUEST_A,
        () => {},
        () => {}
      );
      sdk.onResponseFromSegments(RESPONSE_A);
      // @ts-ignore
      assert.equal(sdk.requestCache.getRequest(RESPONSE_A.id), undefined);
    });
    it("shouldn't remove request with different response", function () {
      // @ts-ignore
      sdk.requestCache.addRequest(
        REQUEST_A,
        () => {},
        () => {}
      );
      sdk.onResponseFromSegments(RESPONSE_B);
      assert.equal(
        // @ts-ignore
        sdk.requestCache.getRequest(RESPONSE_A.id)?.request.id,
        REQUEST_A.id
      );
    });
  });
});
