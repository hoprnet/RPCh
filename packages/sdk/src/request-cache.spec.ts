import assert from "assert";
import { fixtures } from "rpch-common";
import RequestCache from "./request-cache";

const TIMEOUT = 10e3;

describe("test request cache class", function () {
  let requestCache: RequestCache;

  beforeEach(function () {
    requestCache = new RequestCache(jest.fn(() => "MOCK_ON_REQUEST_REMOVAL"));
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
    jest.advanceTimersByTime(2 * TIMEOUT);
    requestCache.removeExpired(TIMEOUT);
    assert.equal(requestCache.getRequest(fixtures.SMALL_REQUEST.id), undefined);
    // @ts-ignore-next-line
    assert.equal(requestCache.onRequestRemoval.mock.calls.length, 1);
    jest.useRealTimers();
  });
});
