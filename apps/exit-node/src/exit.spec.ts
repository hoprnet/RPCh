import assert from "assert";
import * as exit from "./exit";
import { fixtures } from "rpch-commons";
import nock from "nock";
const { PROVIDER } = fixtures;
const PROVIDER_RESPONSE = "Nethermind JSON RPC";
const REQUEST_BODY = "Request Body Example";

describe("test exit node", function () {
  it("Should send request to provider", async function () {
    nock(PROVIDER).post(/.*/).reply(200, PROVIDER_RESPONSE);

    const responseRPC = await exit.sendRpcRequest(REQUEST_BODY, PROVIDER);
    assert.equal(responseRPC, PROVIDER_RESPONSE);
  });
});
