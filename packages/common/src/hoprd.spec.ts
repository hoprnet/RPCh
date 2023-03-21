import assert from "assert";
import nock from "nock";
import * as hoprd from "./hoprd";
import * as fixtures from "./fixtures";
import debug from "debug";
import { ForbiddenError, NotFoundError } from "./errors";

const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_TOKEN = "12345";
const EXIT_NODE_PEER_ID = fixtures.EXIT_NODE_HOPRD_PEER_ID_A;
const NOCK_SEND_MESSAGE = nock(ENTRY_NODE_API_ENDPOINT).post((uri) =>
  uri.includes("/api/v2/messages")
);
const NOCK_CREATE_TOKEN = nock(ENTRY_NODE_API_ENDPOINT).post((uri) =>
  uri.includes("/api/v2/tokens")
);
const NOCK_GET_TOKEN = nock(ENTRY_NODE_API_ENDPOINT).get((uri) =>
  uri.includes("/api/v2/token")
);
const NOCK_DELETE_TOKEN = nock(ENTRY_NODE_API_ENDPOINT).delete((uri) =>
  uri.includes("/api/v2/token")
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
  describe("getToken", () => {
    it("should return a token object", async function () {
      NOCK_GET_TOKEN.reply(200, {
        id: "my-token-id",
        description: "My token description",
        capabilities: [
          {
            endpoint: "/api/v2/token",
            limits: [
              {
                type: "max_calls",
                conditions: [{ max: 100 }],
              },
            ],
          },
        ],
      });
      const token = await hoprd.getToken({
        apiEndpoint: ENTRY_NODE_API_ENDPOINT,
        apiToken: ENTRY_NODE_API_TOKEN,
      });

      expect(token.id).toBe("my-token-id");
      expect(token.description).toBe("My token description");
      expect(token.capabilities.length).toBe(1);
    });

    it("should throw a ForbiddenError when the response status is 403", async function () {
      NOCK_GET_TOKEN.reply(403, "forbidden");
      await expect(
        hoprd.getToken({
          apiEndpoint: ENTRY_NODE_API_ENDPOINT,
          apiToken: ENTRY_NODE_API_TOKEN,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw a generic Error when the response status is not 200 or 403", async function () {
      NOCK_GET_TOKEN.reply(500, "Internal server error");
      await expect(
        hoprd.getToken({
          apiEndpoint: ENTRY_NODE_API_ENDPOINT,
          apiToken: ENTRY_NODE_API_TOKEN,
        })
      ).rejects.toThrow(Error);
    });
  });
  describe("deleteToken", function () {
    it("should return true on success (status 204)", async function () {
      NOCK_DELETE_TOKEN.reply(204);

      const res = await hoprd.deleteToken({
        apiEndpoint: ENTRY_NODE_API_ENDPOINT,
        apiToken: ENTRY_NODE_API_TOKEN,
        tokenToDelete: "dG9rZW4=",
      });

      expect(res).toEqual(true);
    });

    it("should throw a ForbiddenError when the response status is 403", async function () {
      NOCK_DELETE_TOKEN.reply(403);

      await expect(
        hoprd.deleteToken({
          apiEndpoint: ENTRY_NODE_API_ENDPOINT,
          apiToken: ENTRY_NODE_API_TOKEN,
          tokenToDelete: "dG9rZW4=",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw a NotFoundError when the response status is 404", async function () {
      NOCK_DELETE_TOKEN.reply(404);

      await expect(
        hoprd.deleteToken({
          apiEndpoint: ENTRY_NODE_API_ENDPOINT,
          apiToken: ENTRY_NODE_API_TOKEN,
          tokenToDelete: "dG9rZW4=",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
