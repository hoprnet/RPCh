import assert from "assert";
import nock from "nock";
import * as hoprd from "./hoprd";
import * as fixtures from "./fixtures";
import debug from "debug";

const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_TOKEN = "12345";
const EXIT_NODE_PEER_ID = fixtures.EXIT_NODE_HOPRD_PEER_ID_A;

describe("test hoprd.ts / sendMessage", function () {
  it("should return message response", async function () {
    fixtures
      .nockSendMessageApi(nock(ENTRY_NODE_API_ENDPOINT))
      .reply(202, "someresponse");

    const res = await hoprd.sendMessage({
      apiEndpoint: ENTRY_NODE_API_ENDPOINT,
      apiToken: ENTRY_NODE_API_TOKEN,
      destination: EXIT_NODE_PEER_ID,
      message: "hello",
    });
    assert.equal(res, "someresponse");
  });

  it("throw error when response is not status 202", async function () {
    fixtures.nockSendMessageApi(nock(ENTRY_NODE_API_ENDPOINT)).reply(422, {
      status: "UNKNOWN_FAILURE",
      error: "Full error message.",
    });
    try {
      await hoprd.sendMessage({
        apiEndpoint: ENTRY_NODE_API_ENDPOINT,
        apiToken: ENTRY_NODE_API_TOKEN,
        destination: EXIT_NODE_PEER_ID,
        message: "hello",
      });
    } catch (e: any) {
      assert.equal(
        e.message,
        '{"status":"UNKNOWN_FAILURE","error":"Full error message."}'
      );
    }
  });
});
