import assert from "assert";
import { createCheck } from "./check";

describe("test check", function () {
  it("should timeout", async function () {
    const check = createCheck(
      "mock-id",
      () => {
        return new Promise<[boolean, string]>((resolve) => {
          setTimeout(() => resolve([true, ""]), 100);
        });
      },
      0
    );

    const result = await check.run();
    assert(!result.passed);
  });
});
