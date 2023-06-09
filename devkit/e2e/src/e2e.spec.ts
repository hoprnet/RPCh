import assert from "assert";
import * as ethers from "@rpch/ethers";
import * as PRChCrypto from "@rpch/crypto-for-nodejs";
import * as fixtures from "@rpch/common/build/fixtures";

const PROVIDER_URL = fixtures.PROVIDER;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://localhost:3020";
const sdkStore = fixtures.createAsyncKeyValStore();

jest.setTimeout(1e3 * 60 * 1); // one minute
describe("e2e tests", function () {
  const provider = new ethers.RPChProvider(
    PROVIDER_URL,
    {
      crypto: PRChCrypto,
      client: "sandbox",
      timeout: 5000,
      discoveryPlatformApiEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
    },
    sdkStore.set,
    sdkStore.get
  );

  // enable debugging
  provider.sdk.debug.enable("rpch*");

  beforeAll(async function () {
    // sandbox requires 30 seconds to kickstart
    await fixtures.wait(30000);
    await provider.sdk.start();
  }, 60e3);

  afterAll(async function () {
    await provider.sdk.stop();
  });

  it("should get chain id", async function () {
    const network = await provider.getNetwork();
    assert.equal(network.chainId, 100);
  });

  it("should get block number", async function () {
    const blockNumber = await provider.getBlockNumber();
    assert.equal(typeof blockNumber, "number");
  });

  it("should get balance", async function () {
    const balance = await provider.getBalance(
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    );
    assert.equal(balance._isBigNumber, true);
  });

  it("should get network version", async function () {
    const network = await provider.send("net_version", []);
    assert.equal(network, 100);
  });
});
