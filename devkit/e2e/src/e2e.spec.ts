import assert from "assert";
import * as ethers from "@rpch/ethers";
import { fixtures } from "@rpch/common";

const PROVIDER_URL = fixtures.PROVIDER;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
const SDK_TIMEOUT = 10e3;
const FRESH_NODE_THRESHOLD = 20;
const MAX_RESPONSES = 100;
const {
  ENTRY_NODE_API_ENDPOINT = "http://localhost:13301",
  ENTRY_NODE_API_TOKEN,
  ENTRY_NODE_PEER_ID,
  EXIT_NODE_PEER_ID,
  EXIT_NODE_PUB_KEY,
} = process.env;
const sdkStore = fixtures.createAsyncKeyValStore();

jest.setTimeout(1e3 * 60 * 1); // one minute
describe("e2e tests", function () {
  if (
    !ENTRY_NODE_PEER_ID ||
    !EXIT_NODE_PEER_ID ||
    !ENTRY_NODE_API_TOKEN ||
    !EXIT_NODE_PUB_KEY
  ) {
    throw Error(
      "env variables 'ENTRY_NODE_PEER_ID', 'EXIT_NODE_PEER_ID', \
      'ENTRY_NODE_API_TOKEN' or 'EXIT_NODE_PUB_KEY' not set"
    );
  }
  const provider = new ethers.RPChProvider(
    PROVIDER_URL,
    SDK_TIMEOUT,
    {
      discoveryPlatformApiEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
      entryNodeApiEndpoint: ENTRY_NODE_API_ENDPOINT,
      entryNodeApiToken: ENTRY_NODE_API_TOKEN,
      entryNodePeerId: ENTRY_NODE_PEER_ID,
      exitNodePeerId: EXIT_NODE_PEER_ID,
      exitNodePubKey: EXIT_NODE_PUB_KEY,
      freshNodeThreshold: FRESH_NODE_THRESHOLD,
      maxResponses: MAX_RESPONSES,
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
});
