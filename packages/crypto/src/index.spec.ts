import assert from "assert";
import { set_panic_hook, Identity } from ".";

describe("test index.ts", function () {
  beforeAll(async function () {
    // console.log(await init());
    set_panic_hook();
  });

  it("should create an Identity", function () {
    assert.throws(
      () => Identity.load_identity(new Uint8Array()),
      /low level cryptographic error: crypto error/
    );
  });
});
