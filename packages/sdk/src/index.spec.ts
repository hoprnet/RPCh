import assert from "assert";
import nock from "nock";
import { Request, Response } from "rpch-commons";
import { fixtures } from "rpch-commons";
const { PEER_ID_A: ORIGIN, PROVIDER, RPC_REQ_SMALL } = fixtures;
import SDK from "./index";

const REQUEST = new Request(1, ORIGIN, PROVIDER, RPC_REQ_SMALL);
const RESPONSE_BODY = "response";
const RESPONSE_A = new Response(1, RESPONSE_BODY);
const RESPONSE_B = new Response(2, RESPONSE_BODY);
const MOCK_DISCOVERY_PLATFORM_API_ENDPOINT = "https://localhost:3000";
const MOCK_RESPONSE_TEXT =
  "e61bbdda74873540c7244fe69c39f54e5270bd46709c1dcb74c8e3afce7b9e616d";

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

    sdk.sendRequest(REQUEST).then((value) => {
      assert.equal(value.id, REQUEST.id);
      // @ts-ignore
      const pendingRequest = sdk.requestCache.getRequest(REQUEST.id);
      assert.equal(pendingRequest, undefined);
      done();
    });

    sdk.onResponseFromSegments(RESPONSE_A);
  });
  describe("should handle requests correctly when receiving a response", function () {
    it("should remove request with matching response", function () {
      // @ts-ignore
      sdk.requestCache.addRequest(
        REQUEST,
        () => {},
        () => {}
      );
      sdk.onResponseFromSegments(RESPONSE_A);
      // @ts-ignore
      assert.equal(sdk.requestCache.getRequest(REQUEST.id), undefined);
    });
    it("shouldn't remove request with different response", function () {
      // @ts-ignore
      sdk.requestCache.addRequest(
        REQUEST,
        () => {},
        () => {}
      );
      sdk.onResponseFromSegments(RESPONSE_B);
      assert.equal(
        // @ts-ignore
        sdk.requestCache.getRequest(REQUEST.id)?.request.id,
        REQUEST.id
      );
    });
  });
});
