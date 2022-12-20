import assert from "assert";
import { fixtures } from "rpch-common";
import RequestCache from "./request-cache";

const TIMEOUT = 10e3;

describe("test request cache class", function () {
  let requestCache: RequestCache;

  beforeEach(function () {
    requestCache = new RequestCache();
  });

  it("should add request", function () {
    const request = fixtures.createMockedClientRequest();

    requestCache.addRequest(
      request,
      () => {},
      () => {}
    );
    assert.equal(requestCache.getRequest(request.id)?.request.id, request.id);
  });
  it("should remove a request", function () {
    const request = fixtures.createMockedClientRequest();

    requestCache.addRequest(
      request,
      () => {},
      () => {}
    );
    requestCache.removeRequest(request);
    assert.equal(requestCache.getRequest(request.id), undefined);
  });
  it("should timeout request", function () {
    const request = fixtures.createMockedClientRequest();

    jest.useFakeTimers();
    requestCache.addRequest(
      request,
      () => {},
      () => {}
    );
    jest.advanceTimersByTime(2 * TIMEOUT);
    requestCache.removeExpired(TIMEOUT);
    assert.equal(requestCache.getRequest(request.id), undefined);
    jest.useRealTimers();
  });
});
