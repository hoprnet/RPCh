import assert from "assert";
import * as fixtures from "@rpch/common/build/fixtures";
import * as RPChCrypto from "@rpch/crypto-for-nodejs";
import mockSdk from "@rpch/sdk/build/index.mock";
import { RPChEthereumProvider } from ".";

// mock HOPRd interactions
jest.mock("@rpch/common", () => ({
  ...jest.requireActual("@rpch/common"),
  hoprd: {
    sendMessage: jest.fn(async () => "MOCK_SEND_MSG_RESPONSE"),
    createMessageListener: jest.fn(async () => {
      return () => {};
    }),
  },
}));

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

  beforeAll(async function () {
    await provider.sdk.start();
  });

  afterAll(async function () {
    await provider.sdk.stop();
  });

  // hook to emulate responses from the exit node
  provider.sdk = mockSdk(provider.sdk);

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
