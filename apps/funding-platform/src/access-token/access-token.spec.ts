import { AccessToken } from "./access-token";
import assert from "assert";

const MAX_HOPR = 20;
const MOCK_SECRET_KEY = "SECRET_KEY";

describe("test AccessToken class", function () {
  let accessToken: AccessToken;
  beforeEach(function () {
    accessToken = new AccessToken(new Date(), MAX_HOPR, MOCK_SECRET_KEY);
  });
  it("should generate a different hash everytime", function () {
    const firstHash = accessToken.generateHash();
    const secondHash = accessToken.generateHash();
    assert(firstHash !== secondHash);
  });
  it("should return generated hash correctly", function () {
    const generatedHash = accessToken.generateHash();
    const returnedHash = accessToken.getHash();
    assert(returnedHash === generatedHash);
  });
});
