import assert from "assert";
import SDK from "./index";
import {
  PEER_ID_A as ORIGIN,
  PROVIDER,
  RPC_REQ_SMALL,
} from "rpch-commons/src/fixtures";
import { Request } from "rpch-commons";
const REQUEST = new Request(1, ORIGIN, PROVIDER, RPC_REQ_SMALL);

describe("test SDK class", function () {
  let sdk: SDK;
  beforeEach(() => {
    sdk = new SDK();
  });
  it("should request messaging access token", function () {});
  it("should create request", function () {
    const request = sdk.createRequest(ORIGIN, PROVIDER, RPC_REQ_SMALL);
    assert(request instanceof Request);
  });
  it("should send request", function () {});
});
