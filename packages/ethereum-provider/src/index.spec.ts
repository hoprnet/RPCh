import assert from "assert";
import * as fixtures from "@rpch/common/build/fixtures";
import * as RPChCrypto from "@rpch/crypto-for-nodejs";
import { RPChEthereumProvider } from ".";

const PROVIDER_URL = fixtures.PROVIDER;
const TIMEOUT = 5e3;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";

describe("test rpch ethereum provider", function () {
  const sdkStore = fixtures.createAsyncKeyValStore();
  const provider = new RPChEthereumProvider(
    PROVIDER_URL,
    {
      crypto: RPChCrypto,
      client: "",
      timeout: TIMEOUT,
      discoveryPlatformApiEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
    },
    sdkStore.set,
    sdkStore.get
  );

  it("should get chain id", async function () {
    const res = await provider.request({ method: "eth_chainId", params: [] });
    assert.equal(res, 1);
  });

  it("should get block number", async function () {
    const res = await provider.request({
      method: "eth_blockNumber",
      params: [],
    });
    assert.equal(res, 25135304);
  });
});
