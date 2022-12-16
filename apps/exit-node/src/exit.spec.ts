import assert from "assert";
import nock from "nock";
import * as exit from "./exit";
import { fixtures } from "@rpch/common";

describe("test exit.ts", function () {
  it("should send a request to a provider and receive a string", async function () {
    nock(fixtures.PROVIDER).post(/.*/).reply(200, fixtures.RPC_RES_LARGE);

    const response = await exit.sendRpcRequest(
      fixtures.RPC_REQ_LARGE,
      fixtures.PROVIDER
    );
    assert.equal(response, fixtures.RPC_RES_LARGE);
  });
  it("should send a request to a provider and throw an error", async function () {
    nock(fixtures.PROVIDER).post(/.*/).reply(404, "Not Found");

    try {
      await exit.sendRpcRequest(fixtures.RPC_REQ_LARGE, fixtures.PROVIDER);
    } catch (error) {
      assert.equal(error, "Not Found");
    }
  });
});
