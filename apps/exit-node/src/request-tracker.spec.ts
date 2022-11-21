import assert from "assert";
import { Request } from "rpch-commons";
import RequestTracker from "./request-tracker";

const RESPONSE_TIMEOUT_STR = "10000";

function wait(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

describe("Test RequestTracker class", function () {
  const requestTracker = new RequestTracker(Number(1e2));

  it("Should remove expired requests", function () {
    requestTracker.onRequest(
      new Request(0, "origin", "infura", "Test request")
    );
    wait(1e3);
    requestTracker.onRequest(
      new Request(1, "origin", "infura", "Test request not expired")
    );
    requestTracker.setInterval();
  });
});
