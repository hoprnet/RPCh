import assert from "assert";
import nock from "nock";
import { type Message, Request, Response, fixtures } from "rpch-common";
import { RPChProvider } from ".";

const PROVIDER_URL = fixtures.PROVIDER;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_TOKEN = "12345";
const ENTRY_NODE = fixtures.IDENTITY_A_NO_PRIV;
const EXIT_NODE = fixtures.IDENTITY_B_NO_PRIV;
const EXIT_NODE_WITH_PRIV = fixtures.IDENTITY_B;
const FRESH_NODE_THRESHOLD = 20;
const MAX_RESPONSES = 100;

let lastRequestFromClient = BigInt(0);

const getMockedResponse = async (request: Request): Promise<Message> => {
  const rpcId: number = JSON.parse(request.body)["id"];
  let body: string = "";
  if (request.body.includes("eth_chainId")) {
    body = `{"jsonrpc": "2.0","result": "0x01","id": ${rpcId}}`;
  } else if (request.body.includes("eth_blockNumber")) {
    body = `{"jsonrpc": "2.0","result": "0x17f88c8","id": ${rpcId}}`;
  }

  await fixtures.wait(10);

  const exitNodeRequest = Request.fromMessage(
    request.toMessage(),
    EXIT_NODE_WITH_PRIV,
    lastRequestFromClient,
    (counter) => {
      lastRequestFromClient = counter;
    }
  );
  const exitNodeResponse = Response.createResponse(exitNodeRequest, body);

  await fixtures.wait(10);

  return exitNodeResponse.toMessage();
};

jest.mock("rpch-common", () => ({
  ...jest.requireActual("rpch-common"),
  hoprd: {
    sendMessage: jest.fn(async () => "MOCK_SEND_MSG_RESPONSE"),
    createMessageListener: jest.fn(async () => {
      return () => {};
    }),
  },
}));

describe("test index.ts", function () {
  const provider = new RPChProvider(PROVIDER_URL, {
    discoveryPlatformApiEndpoint: DISCOVERY_PLATFORM_API_ENDPOINT,
    entryNodeApiEndpoint: ENTRY_NODE_API_ENDPOINT,
    entryNodeApiToken: ENTRY_NODE_API_TOKEN,
    entryNodePeerId: ENTRY_NODE.peerId.toB58String(),
    exitNodePeerId: EXIT_NODE.peerId.toB58String(),
    freshNodeThreshold: FRESH_NODE_THRESHOLD,
    maxResponses: MAX_RESPONSES,
  });

  beforeAll(async function () {
    await provider.sdk.start();

    // pseudo responses from entry node
    fixtures
      .nockSendMessageApi(nock(ENTRY_NODE_API_ENDPOINT).persist())
      .reply(202, "someresponse");
  });

  afterAll(async function () {
    await provider.sdk.stop();
  });

  // hook to emulate responses from the exit node
  const originalSendRequest = provider.sdk.sendRequest.bind(provider.sdk);
  provider.sdk.sendRequest = async (request: Request): Promise<Response> => {
    const now = Date.now();
    setTimeout(() => {
      getMockedResponse(request).then((responseMessage) => {
        // @ts-ignore
        provider.sdk.onMessage(responseMessage);
      });
    }, 100);
    return originalSendRequest(request);
  };

  it("should get chain id", async function () {
    const network = await provider.getNetwork();
    assert.equal(network.chainId, 1);
  });

  it("should get block number", async function () {
    const blockNumber = await provider.getBlockNumber();
    assert.equal(blockNumber, 25135304);
  });
});
