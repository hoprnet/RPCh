import assert from "assert";
import { Response } from "@rpch/common";
import * as fixtures from "@rpch/common/build/fixtures";
import { parseResponse, getResult } from "./utils";

describe("test utils.ts / parseResponse", function () {
  const GOOD_RESPONSE = { body: fixtures.RPC_RES_LARGE } as Response;
  const BAD_RESPONSE = { body: "" } as Response;

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
  const OK_PARSED = parseResponse({ body: fixtures.RPC_RES_LARGE } as Response);
  const ERROR_PARSED = parseResponse({
    body: fixtures.RPC_RES_ERROR,
  } as Response);

  it("should get result", function () {
    assert.equal(
      getResult(OK_PARSED),
      JSON.parse(fixtures.RPC_RES_LARGE).result
    );
  });

  it("should throw error", function () {
    assert.throws(
      () => getResult(ERROR_PARSED),
      "ExampleMethodresultismissing"
    );
  });
});
