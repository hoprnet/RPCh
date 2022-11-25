import { type Request, type Response, fixtures } from "rpch-commons";
import { RPChProvider } from ".";
import nock from "nock";

const TIMEOUT = 10e3;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_TOKEN = "12345";
const ENTRY_NODE_PEER_ID = fixtures.PEER_ID_A;
const EXIT_NODE_PEER_ID = fixtures.PEER_ID_B;

const getMockedResponse = (request: Request): Response => {
  const rpcId: number = JSON.parse(request.body)["id"];
  let body: string = "";

  if (request.body.includes("eth_chainId")) {
    body = `{"jsonrpc": "2.0","result": "0x64","id": ${rpcId}}`;
  } else if (request.body.includes("eth_blockNumber")) {
    body = `{"jsonrpc": "2.0","result": "0x17f88c8","id": ${rpcId}}`;
  }

  return request.createResponse(body);
};

describe("test index.ts", function () {
  nock(ENTRY_NODE_API_ENDPOINT).persist().post(/.*/).reply(202, "someresponse");

  const provider = new RPChProvider(
    ENTRY_NODE_API_ENDPOINT,
    ENTRY_NODE_PEER_ID,
    {
      timeout: TIMEOUT,
      discoveryPlatformApiEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
      entryNodeApiEndpoint: ENTRY_NODE_API_ENDPOINT,
      entryNodeApiToken: ENTRY_NODE_API_TOKEN,
      exitNodePeerId: EXIT_NODE_PEER_ID,
    }
  );

  it("should get block number", async function () {
    const p = provider.getBlockNumber();
    setTimeout(() => {
      // @ts-ignore
      const entry = Array.from(provider.sdk.requestCache.requests.values())[0];
      const response = getMockedResponse(entry.request);
      provider.sdk.onResponseFromSegments(response);
    }, 1e3);
    const blockNumber = await p;
    console.log(blockNumber);
  });
});
