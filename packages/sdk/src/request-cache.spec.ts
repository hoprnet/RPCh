import assert from "assert";
import { Cache, Request, Response } from "rpch-commons";
import { fixtures } from "rpch-commons";
const { TIMEOUT, REQUEST_A } = fixtures;
import RequestCache from "./request-cache";

describe("test request cache class", function () {
  let requestCache: RequestCache;
  beforeEach(() => {
    requestCache = new RequestCache(TIMEOUT);
  });
  it("should add request", function () {
    requestCache.addRequest(
      REQUEST_A,
      () => {},
      () => {}
    );
    assert.equal(
      requestCache.getRequest(REQUEST_A.id)?.request.id,
      REQUEST_A.id
    );
  });
  it("should remove a request", function () {
    requestCache.addRequest(
      REQUEST_A,
      () => {},
      () => {}
    );
    requestCache.removeRequest(REQUEST_A);
    assert.equal(requestCache.getRequest(REQUEST_A.id), undefined);
  });
  it("should timeout request", function () {
    jest.useFakeTimers();
    requestCache.addRequest(
      REQUEST_A,
      () => {},
      () => {}
    );
    requestCache.setInterval();
    jest.advanceTimersByTime(2 * TIMEOUT);
    assert.equal(requestCache.getRequest(REQUEST_A.id), undefined);
    jest.useRealTimers();
  });
});
