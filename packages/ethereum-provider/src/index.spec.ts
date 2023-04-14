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

  it("should get chain id", function (done) {
    provider.send(
      { id: 1, jsonrpc: "2.0", method: "eth_chainId", params: [] },
      (err, res) => {
        assert.equal(res?.result, 1);
        done();
      }
    );
  });

  it("should get block number", function (done) {
    provider.send(
      { id: 1, jsonrpc: "2.0", method: "eth_blockNumber", params: [] },
      (err, res) => {
        assert.equal(res?.result, 25135304);
        done();
      }
    );
  });
});
