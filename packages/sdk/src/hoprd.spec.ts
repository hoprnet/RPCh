import assert from "assert";
import * as hoprd from "./hoprd";
import nock from "nock";
import { fixtures } from "rpch-commons";

const {
  MOCK_API_TOKEN,
  MOCK_DESTINATION,
  MOCK_DISCOVERY_PLATFORM_API_ENDPOINT,
  MOCK_RESPONSE_TEXT,
} = fixtures;

describe("test hoprd module", function () {
  it("log when message is status 202", async function () {
    nock(MOCK_DISCOVERY_PLATFORM_API_ENDPOINT)
      .post(/.*/)
      .reply(202, MOCK_RESPONSE_TEXT);
    const res = await hoprd.sendMessage({
      apiEndpoint: MOCK_DISCOVERY_PLATFORM_API_ENDPOINT,
      apiToken: MOCK_API_TOKEN,
      destination: MOCK_DESTINATION,
      message: "hello",
    });
    assert.equal(res, MOCK_RESPONSE_TEXT);
  });
  it("log error when response is not status 202", async function () {
    nock(MOCK_DISCOVERY_PLATFORM_API_ENDPOINT).post(/.*/).reply(422, {
      status: "UNKNOWN_FAILURE",
      error: "Full error message.",
    });
    const res = await hoprd.sendMessage({
      apiEndpoint: MOCK_DISCOVERY_PLATFORM_API_ENDPOINT,
      apiToken: MOCK_API_TOKEN,
      destination: MOCK_DESTINATION,
      message: "hello",
    });
    assert.equal(res, undefined);
  });
});
