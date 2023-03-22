import assert from "assert";
import { generateAccessToken, isExpired } from "./index";

const MOCK_MAX_AMOUNT = BigInt(20);
const MOCK_SECRET_KEY = "SECRET_KEY";
const MOCK_ACCESS_TOKEN_PARAMS = {
  amount: MOCK_MAX_AMOUNT,
  expiredAt: new Date(Date.now()),
  secretKey: MOCK_SECRET_KEY,
};

describe("test utils file", function () {
  describe("isExpired function", function () {
    it("should handle expired dates", function () {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2020-02-19"));
      const pastDate = new Date(Date.now()).toISOString();
      jest.setSystemTime(new Date("2020-02-20"));
      const res = isExpired(pastDate);
      jest.useRealTimers();
      assert(res);
    });
    it("should handle active dates", function () {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2020-02-20"));
      const futureDate = new Date(Date.now()).toISOString();
      jest.setSystemTime(new Date("2020-02-19"));
      const res = isExpired(futureDate);
      jest.useRealTimers();
      assert(!res);
    });
  });

  describe("test AccessToken class", function () {
    it("should generate a different hash every time", function () {
      const firstHash = generateAccessToken(MOCK_ACCESS_TOKEN_PARAMS);
      const secondHash = generateAccessToken(MOCK_ACCESS_TOKEN_PARAMS);
      assert(firstHash !== secondHash);
    });
  });
});
