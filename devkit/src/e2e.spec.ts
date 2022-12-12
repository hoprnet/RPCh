import assert from "assert";
import * as ethers from "rpch-ethers";
import { fixtures } from "rpch-common";

const PROVIDER_URL = fixtures.PROVIDER;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
const ENTRY_NODE_API_ENDPOINT = "http://localhost:13301";
const ENTRY_NODE_API_TOKEN = "^^awesomeHOPRr3l4y^^";
const ENTRY_NODE_PEER_ID =
  "16Uiu2HAmFKxYVn95UhmEzEvdgkCcrwAimWQHt3dppPxsYhyz1dQJ";
const EXIT_NODE_PEER_ID =
  "16Uiu2HAm28BratT3U1r4eabs5EKYTv3jXbLUNTTNdLSPYadRAUr2";

//  Should maybe perform a health check on the node we want to test
jest.setTimeout(2e4);
describe("e2e tests", function () {
  const provider = new ethers.RPChProvider(PROVIDER_URL, {
    discoveryPlatformApiEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
    entryNodeApiEndpoint: ENTRY_NODE_API_ENDPOINT,
    entryNodeApiToken: ENTRY_NODE_API_TOKEN,
    entryNodePeerId: ENTRY_NODE_PEER_ID,
    exitNodePeerId: EXIT_NODE_PEER_ID,
  });

  beforeAll(async function () {
    await provider.sdk.start();

    // // pseudo responses from entry node
    // fixtures
    //   .nockSendMessageApi(nock(ENTRY_NODE_API_ENDPOINT).persist())
    //   .reply(202, "someresponse");
  });

  afterAll(async function () {
    await provider.sdk.stop();
  });

  it("should get chain id", async function () {
    const network = await provider.getNetwork();
    assert.equal(network.chainId, 1);
  });

  it("should get block number", async function () {
    const blockNumber = await provider.getBlockNumber();
    assert.equal(blockNumber, 25135304);
  });

  it("should get balance", async function () {
    const blockNumber = await provider.getBalance(
      "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    );
    assert.equal(blockNumber, 25135304);
  });

  it("should get balance", async function () {
    const blockNumber = await provider.getEtherPrice();
    assert.equal(blockNumber, 25135304);
  });
});
