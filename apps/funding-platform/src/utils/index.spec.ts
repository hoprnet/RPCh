import assert from "assert";
import { isExpired } from "./index";

describe("test utils file", function () {
  describe("isExpired function", function () {
    it("should handle expired dates", function () {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2020-02-19"));
      const pastDate = new Date(Date.now()).toISOString();
      jest.setSystemTime(new Date("2020-02-20"));
      const res = isExpired(pastDate);
      assert(res);
    });
    it("should handle active dates", function () {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2020-02-20"));
      const futureDate = new Date(Date.now()).toISOString();
      jest.setSystemTime(new Date("2020-02-19"));
      const res = isExpired(futureDate);
      assert(!res);
    });
  });
});
