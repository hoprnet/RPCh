import assert from "assert";
import { Cache, Request, Response } from "rpch-commons";
import { fixtures } from "rpch-commons";
const { PEER_ID_A: ORIGIN, PROVIDER, RPC_REQ_SMALL } = fixtures;
import RequestCache from "./request-cache";
const TIMEOUT = 60e3;
const RESPONSE_BODY = "response";
const RESPONSE_A = new Response(1, RESPONSE_BODY);
const RESPONSE_B = new Response(2, RESPONSE_BODY);
const REQUEST = new Request(1, ORIGIN, PROVIDER, RPC_REQ_SMALL);
function wait(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}
describe("test request cache class", function () {
  let requestCache: RequestCache;
  let cache: Cache;
  beforeEach(() => {
    requestCache = new RequestCache(TIMEOUT);
    cache = new Cache(
      TIMEOUT,
      requestCache.onRequestFromSegments,
      requestCache.onResponseFromSegments
    );
  });
  it("should add request", function () {
    requestCache.addRequest(
      REQUEST,
      () => {},
      () => {}
    );
    assert.equal(requestCache.getRequest(REQUEST.id)?.request.id, REQUEST.id);
  });
  it("should remove request with matching response", function () {
    requestCache.addRequest(
      REQUEST,
      () => {},
      () => {}
    );
    requestCache.onResponseFromSegments(RESPONSE_A);
    assert.equal(requestCache.getRequest(REQUEST.id), undefined);
  });
  it("shouldn't remove request with different response", function () {
    requestCache.addRequest(
      REQUEST,
      () => {},
      () => {}
    );
    requestCache.onResponseFromSegments(RESPONSE_B);
    assert.equal(requestCache.getRequest(REQUEST.id)?.request.id, REQUEST.id);
  });
  it("should timeout request", function () {
    jest.useFakeTimers();
    requestCache.addRequest(
      REQUEST,
      () => {},
      () => {}
    );
    requestCache.setInterval();
    jest.advanceTimersByTime(2 * TIMEOUT);
    assert.equal(requestCache.getRequest(REQUEST.id), undefined);
    jest.useRealTimers();
  });
});
