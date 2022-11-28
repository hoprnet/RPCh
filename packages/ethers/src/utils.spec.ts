import assert from "assert";
import { Response, fixtures } from "rpch-common";
import { parseResponse, getResult } from "./utils";

describe("test utils.ts / parseResponse", function () {
  const GOOD_RESPONSE = fixtures.LARGE_RESPONSE;
  const BAD_RESPONSE = new Response(1, "");

  it("should parse Response", function () {
    assert.deepEqual(
      parseResponse(GOOD_RESPONSE),
      JSON.parse(GOOD_RESPONSE.body)
    );
  });

  it("should throw when parsing Response", function () {
    assert.throws(() => parseResponse(BAD_RESPONSE), "not parsable");
  });
});

describe("test utils.ts / getResult", function () {
  const OK_PARSED = parseResponse(fixtures.LARGE_RESPONSE);
  const ERROR_PARSED = parseResponse(new Response(1, fixtures.RPC_RES_ERROR));

  it("should get result", function () {
    assert.equal(
      getResult(OK_PARSED),
      JSON.parse(fixtures.LARGE_RESPONSE.body).result
    );
  });

  it("should throw error", function () {
    assert.throws(
      () => getResult(ERROR_PARSED),
      "ExampleMethodresultismissing"
    );
  });
});
