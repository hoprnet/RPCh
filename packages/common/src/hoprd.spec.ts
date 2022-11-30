import assert from "assert";
import nock from "nock";
import * as hoprd from "./hoprd";
import * as fixtures from "./fixtures";

const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_TOKEN = "12345";
const EXIT_NODE_PEER_ID = fixtures.PEER_ID_B;

describe("test hoprd.ts / sendMessage", function () {
  it("should return message response", async function () {
    nock(ENTRY_NODE_API_ENDPOINT).post(/.*/).reply(202, "someresponse");
    const res = await hoprd.sendMessage({
      apiEndpoint: ENTRY_NODE_API_ENDPOINT,
      apiToken: ENTRY_NODE_API_TOKEN,
      destination: EXIT_NODE_PEER_ID,
      message: "hello",
    });
    assert.equal(res, "someresponse");
  });
  it("log error when response is not status 202", async function () {
    nock(ENTRY_NODE_API_ENDPOINT).post(/.*/).reply(422, {
      status: "UNKNOWN_FAILURE",
      error: "Full error message.",
    });
    const res = await hoprd.sendMessage({
      apiEndpoint: ENTRY_NODE_API_ENDPOINT,
      apiToken: ENTRY_NODE_API_TOKEN,
      destination: EXIT_NODE_PEER_ID,
      message: "hello",
    });
    assert.equal(res, undefined);
  });
});
