import assert from "assert";
import * as fixtures from "@rpch/common/build/fixtures";
import RequestCache from "./request-cache";

const TIMEOUT = 10e3;

describe("test request cache class", function () {
  let requestCache: RequestCache;

  beforeEach(function () {
    requestCache = new RequestCache(jest.fn(() => "MOCK_ON_REQUEST_REMOVAL"));
  });

  it("should add request", async function () {
    const [request] = await fixtures.generateMockedFlow(1);

    requestCache.addRequest(
      request,
      () => {},
      () => {}
    );
    assert.equal(requestCache.getRequest(request.id)?.request.id, request.id);
  });
  it("should remove a request", async function () {
    const [request] = await fixtures.generateMockedFlow(1);

    requestCache.addRequest(
      request,
      () => {},
      () => {}
    );
    requestCache.removeRequest(request);
    assert.equal(requestCache.getRequest(request.id), undefined);
  });
  it("should timeout request", async function () {
    const [request] = await fixtures.generateMockedFlow(1);

    jest.useFakeTimers();
    requestCache.addRequest(
      request,
      () => {},
      () => {}
    );
    jest.advanceTimersByTime(2 * TIMEOUT);
    requestCache.removeExpired(TIMEOUT);
    assert.equal(requestCache.getRequest(request.id), undefined);
    // @ts-ignore-next-line
    assert.equal(requestCache.onRequestRemoval.mock.calls.length, 1);
    jest.useRealTimers();
  });
});
