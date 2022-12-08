import { generateAccessToken } from "./access-token";
import assert from "assert";

const MOCK_MAX_AMOUNT = 20;
const MOCK_SECRET_KEY = "SECRET_KEY";
const MOCK_ACCESS_TOKEN_PARAMS = {
  amount: MOCK_MAX_AMOUNT,
  expiredAt: new Date(Date.now()),
  secretKey: MOCK_SECRET_KEY,
};
describe("test AccessToken class", function () {
  it("should generate a different hash everytime", function () {
    const firstHash = generateAccessToken(MOCK_ACCESS_TOKEN_PARAMS);
    const secondHash = generateAccessToken(MOCK_ACCESS_TOKEN_PARAMS);
    assert(firstHash !== secondHash);
  });
});
