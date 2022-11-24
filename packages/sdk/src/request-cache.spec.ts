import assert from "assert";
import { fixtures, Request } from "rpch-commons";
import RequestCache from "./request-cache";

const { PEER_ID_A: ORIGIN, PROVIDER, RPC_REQ_SMALL } = fixtures;
const TIMEOUT = 10e3;
const REQUEST = new Request(1, ORIGIN, PROVIDER, RPC_REQ_SMALL);

describe("test request cache class", function () {
  let requestCache: RequestCache;
  beforeEach(() => {
    requestCache = new RequestCache(TIMEOUT);
  });
  it("should add request", function () {
    requestCache.addRequest(
      REQUEST,
      () => {},
      () => {}
    );
    assert.equal(requestCache.getRequest(REQUEST.id)?.request.id, REQUEST.id);
  });
  it("should remove a request", function () {
    requestCache.addRequest(
      REQUEST,
      () => {},
      () => {}
    );
    requestCache.removeRequest(REQUEST);
    assert.equal(requestCache.getRequest(REQUEST.id), undefined);
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
