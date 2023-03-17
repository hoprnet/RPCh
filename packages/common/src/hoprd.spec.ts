import assert from "assert";
import nock from "nock";
import * as hoprd from "./hoprd";
import * as fixtures from "./fixtures";
import debug from "debug";

const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_TOKEN = "12345";
const EXIT_NODE_PEER_ID = fixtures.EXIT_NODE_HOPRD_PEER_ID_A;
const NOCK_SEND_MESSAGE = nock(ENTRY_NODE_API_ENDPOINT).post((uri) =>
  uri.includes("/api/v2/messages")
);
const NOCK_CREATE_TOKEN = nock(ENTRY_NODE_API_ENDPOINT).post((uri) =>
  uri.includes("/api/v2/tokens")
);

describe("test hoprd.ts", function () {
  describe("sendMessage", function () {
    it("should return message response", async function () {
      NOCK_SEND_MESSAGE.reply(202, "someresponse");

      const res = await hoprd.sendMessage({
        apiEndpoint: ENTRY_NODE_API_ENDPOINT,
        apiToken: ENTRY_NODE_API_TOKEN,
        destination: EXIT_NODE_PEER_ID,
        message: "hello",
        path: [],
      });
      assert.equal(res, "someresponse");
    });

    it("log error when response is not status 202", async function () {
      NOCK_SEND_MESSAGE.reply(422, {
        status: "UNKNOWN_FAILURE",
        error: "Full error message.",
      });
      try {
        await hoprd.sendMessage({
          apiEndpoint: ENTRY_NODE_API_ENDPOINT,
          apiToken: ENTRY_NODE_API_TOKEN,
          destination: EXIT_NODE_PEER_ID,
          message: "hello",
          path: [],
        });
      } catch (e: any) {
        assert.equal(
          e.message,
          '{"status":"UNKNOWN_FAILURE","error":"Full error message."}'
        );
      }
    });
  });
  describe("createToken", function () {
    it("should return a token", async function () {
      NOCK_CREATE_TOKEN.reply(201, {
        token: "token",
      });

      const res = await hoprd.createToken({
        apiEndpoint: ENTRY_NODE_API_ENDPOINT,
        apiToken: ENTRY_NODE_API_TOKEN,
        tokenCapabilities: ["tokensCreate"],
        description: "test",
        maxCalls: 100,
      });

      assert.equal(res, "token");
    });
    it("throws error when response is not status 202", async function () {
      NOCK_CREATE_TOKEN.reply(422, {
        status: "UNKNOWN_FAILURE",
        error: "Full error message.",
      });
      try {
        await hoprd.createToken({
          apiEndpoint: ENTRY_NODE_API_ENDPOINT,
          apiToken: ENTRY_NODE_API_TOKEN,
          tokenCapabilities: ["tokensCreate"],
          description: "test",
          maxCalls: 100,
        });
      } catch (e: any) {
        assert.equal(
          e.message,
          '{"status":"UNKNOWN_FAILURE","error":"Full error message."}'
        );
      }
    });
  });
});
