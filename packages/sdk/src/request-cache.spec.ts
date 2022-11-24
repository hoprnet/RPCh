import assert from "assert";
import { fixtures } from "rpch-commons";
import RequestCache from "./request-cache";

const TIMEOUT = 10e3;

describe("test request cache class", function () {
  let requestCache: RequestCache;

  beforeEach(function () {
    requestCache = new RequestCache(TIMEOUT);
  });

  it("should add request", function () {
    requestCache.addRequest(
      fixtures.SMALL_REQUEST,
      () => {},
      () => {}
    );
    assert.equal(
      requestCache.getRequest(fixtures.SMALL_REQUEST.id)?.request.id,
      fixtures.SMALL_REQUEST.id
    );
  });
  it("should remove a request", function () {
    requestCache.addRequest(
      fixtures.SMALL_REQUEST,
      () => {},
      () => {}
    );
    requestCache.removeRequest(fixtures.SMALL_REQUEST);
    assert.equal(requestCache.getRequest(fixtures.SMALL_REQUEST.id), undefined);
  });
  it("should timeout request", function () {
    jest.useFakeTimers();
    requestCache.addRequest(
      fixtures.SMALL_REQUEST,
      () => {},
      () => {}
    );
    requestCache.setInterval();
    jest.advanceTimersByTime(2 * TIMEOUT);
    assert.equal(requestCache.getRequest(fixtures.SMALL_REQUEST.id), undefined);
    jest.useRealTimers();
  });
});
