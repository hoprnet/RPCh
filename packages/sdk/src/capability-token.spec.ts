import CapabilityToken from "./capability-token";
import fetch from "node-fetch";
import nock from "nock";
import { Response } from "node-fetch";

const DISCOVERY_PLATFORM_API_ENDPOINT = "https://example.com";

// Define the Nock endpoints
const DP_GET_NODE = nock(DISCOVERY_PLATFORM_API_ENDPOINT).get(
  "/api/v1/node/nodeId/refresh"
);

describe("CapabilityToken", function () {
  let capabilityToken: CapabilityToken;

  beforeEach(function () {
    capabilityToken = new CapabilityToken(
      DISCOVERY_PLATFORM_API_ENDPOINT,
      "nodeId",
      "token"
    );
  });

  afterEach(function () {
    nock.cleanAll();
  });

  describe("getToken", function () {
    it("should return the initial token", async function () {
      const token = await capabilityToken.getToken();
      expect(token).toBe("token");
    });

    it("should request a new token when the current token has expired", async function () {
      DP_GET_NODE.reply(200, { token: "newToken" });

      // set the expireTime to be in the past
      capabilityToken = new CapabilityToken(
        DISCOVERY_PLATFORM_API_ENDPOINT,
        "nodeId",
        "token"
      );
      capabilityToken["expireTime"] = Date.now() - 1000;

      const token = await capabilityToken.getToken();
      expect(token).toBe("newToken");
    });

    it("should request a new token when the current token has reached its usage limit", async function () {
      // set the usedCalls to be equal to MAX_CALLS
      capabilityToken = new CapabilityToken(
        DISCOVERY_PLATFORM_API_ENDPOINT,
        "nodeId",
        "token"
      );
      capabilityToken["usedCalls"] = 10000;

      DP_GET_NODE.reply(200, { token: "newToken" });

      const token = await capabilityToken.getToken();
      expect(token).toBe("newToken");
    });

    it("should increment the usedCalls counter by the messages parameter", async function () {
      DP_GET_NODE.reply(200, { token: "newToken" });

      await capabilityToken.getToken(3);
      expect(capabilityToken["usedCalls"]).toBe(3);
    });

    it("should throw an error when the request to the Discovery Platform API fails with an error", async function () {
      DP_GET_NODE.reply(500, { token: "newToken" });

      await expect(capabilityToken["requestNewToken"]()).rejects.toThrowError(
        "Failed to get new token from discovery platform"
      );
    });
    it("should increment the usedCalls counter by the messages parameter", async function () {
      DP_GET_NODE.reply(200, { token: "token" });

      await capabilityToken.getToken(3);
      expect(capabilityToken["usedCalls"]).toBe(3);
    });
    test("should throw an error when the request to the Discovery Platform API returns a bad response", async function () {
      DP_GET_NODE.reply(400, { error: "Bad Request" });

      await expect(capabilityToken["requestNewToken"]()).rejects.toThrowError(
        "Failed to get new token from discovery platform"
      );
    });
  });
});
