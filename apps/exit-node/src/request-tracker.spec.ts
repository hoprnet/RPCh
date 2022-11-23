import assert from "assert";
import { Request, Response, fixtures } from "rpch-commons";
import RequestTracker from "./request-tracker";
const { PEER_ID_A: ORIGIN, PROVIDER, RPC_REQ_SMALL } = fixtures;

const TIMEOUT = 60e3;
const RESPONSE_BODY = "response";
const RESPONSE_A = new Response(1, RESPONSE_BODY);
const RESPONSE_B = new Response(2, RESPONSE_BODY);
const REQUEST = new Request(1, ORIGIN, PROVIDER, RPC_REQ_SMALL);

describe("Test RequestTracker class", function () {
  let requestTracker: RequestTracker;

  beforeEach(() => {
    requestTracker = new RequestTracker(TIMEOUT);
  });

  it("Should add request", function () {
    requestTracker.onRequest(REQUEST);

    assert.equal(requestTracker.getRequest(REQUEST.id)?.request.id, REQUEST.id);
  });

  it("Should remove request with matching response", function () {
    requestTracker.onRequest(REQUEST);

    requestTracker.onResponse(RESPONSE_A);
    assert.equal(requestTracker.getRequest(REQUEST.id), undefined);
  });

  it("Shouldn't remove request with different response", function () {
    requestTracker.onRequest(REQUEST);

    requestTracker.onResponse(RESPONSE_B);
    assert.equal(requestTracker.getRequest(REQUEST.id)?.request.id, REQUEST.id);
  });

  it("Should timeout request", function () {
    jest.useFakeTimers();
    requestTracker.onRequest(REQUEST);

    requestTracker.setInterval();
    jest.advanceTimersByTime(2 * TIMEOUT);
    assert.equal(requestTracker.getRequest(REQUEST.id), undefined);
    jest.useRealTimers();
  });
});
