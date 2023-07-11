import assert from "assert";
import * as fixtures from "@rpch/common/build/fixtures";
import * as RPChCrypto from "@rpch/crypto-for-nodejs";
import { RPChProvider } from ".";

const PROVIDER_URL = fixtures.PROVIDER;
const TIMEOUT = 5e3;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";

describe("test index.ts", function () {
  const sdkStore = fixtures.createAsyncKeyValStore();
  const provider = new RPChProvider(
    PROVIDER_URL,
    {
      crypto: RPChCrypto,
      client: "client",
      timeout: TIMEOUT,
      discoveryPlatformApiEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
    },
    sdkStore.set,
    sdkStore.get
  );

  it("should get chain id", async function () {
    const network = await provider.getNetwork();
    assert.equal(network.chainId, 1);
  });

  it("should get block number", async function () {
    const blockNumber = await provider.getBlockNumber();
    assert.equal(blockNumber, 25135304);
  });
});
