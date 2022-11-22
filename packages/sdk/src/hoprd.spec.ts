import assert from "assert";
import * as hoprd from "./hoprd";
import nock from "nock";
const MOCK_DISCOVERY_PLATFORM_API_ENDPOINT = "https://localhost:3000";
const MOCK_API_TOKEN = "123456789";
const MOCK_DESTINATION =
  "16Uiu2HAmM9KAPaXA4eAz58Q7Eb3LEkDvLarU4utkyL6vM5mwDeEK";
const MOCK_RESPONSE_TEXT =
  "e61bbdda74873540c7244fe69c39f54e5270bd46709c1dcb74c8e3afce7b9e616d";
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
