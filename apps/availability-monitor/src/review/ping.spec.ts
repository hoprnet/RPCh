import type { HoprSDK } from "@hoprnet/hopr-sdk";
import assert from "assert";
import { measureAveragePing } from "./ping";

describe("test measureAveragePing", function () {
  it("should measure average ping of 10", async function () {
    const result = await measureAveragePing(
      {
        api: { node: { pingNode: () => Promise.resolve({ latency: 10 }) } },
      } as unknown as HoprSDK,
      "target_peer_id"
    );
    assert.equal(result, 10);
  });

  it("should return -1 if no ping is a success", async function () {
    const result = await measureAveragePing(
      {
        api: { node: { pingNode: () => Promise.reject() } },
      } as unknown as HoprSDK,
      "target_peer_id"
    );
    assert.equal(result, -1);
  });
});
