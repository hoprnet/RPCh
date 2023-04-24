import nock from "nock";
import { type Message, Request, Response } from "@rpch/common";
import * as fixtures from "@rpch/common/build/fixtures";
import * as crypto from "@rpch/crypto-for-nodejs";
import SDK from ".";

export const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
export const ENTRY_NODE_API_ENDPOINT = "http://entry_node:12345";
export const ENTRY_NODE_API_TOKEN = "12345";
export const ENTRY_NODE_PEER_ID = fixtures.HOPRD_PEER_ID_A;
export const EXIT_NODE_PEER_ID = fixtures.EXIT_NODE_HOPRD_PEER_ID_A;
export const EXIT_NODE_PUB_KEY = fixtures.EXIT_NODE_PUB_KEY_A;
export const EXIT_NODE_WRITE_IDENTITY = fixtures.EXIT_NODE_WRITE_IDENTITY_A;

// send message to entry node
nock(ENTRY_NODE_API_ENDPOINT)
  .post("/api/v2/messages")
  .reply(202, "someresponse")
  .persist();

// request entry node
nock(DISCOVERY_PLATFORM_API_ENDPOINT)
  .post("/api/v1/request/entry-node")
  .reply(200, {
    hoprd_api_endpoint: ENTRY_NODE_API_ENDPOINT,
    hoprd_api_token: ENTRY_NODE_API_TOKEN,
    accessToken: ENTRY_NODE_API_TOKEN,
    id: ENTRY_NODE_PEER_ID,
  })
  .persist();

// get exit nodes
nock(DISCOVERY_PLATFORM_API_ENDPOINT)
  .get("/api/v1/node?hasExitNode=true")
  .reply(200, [
    {
      exit_node_pub_key: EXIT_NODE_PUB_KEY,
      id: EXIT_NODE_PEER_ID,
    },
  ])
  .persist();

// where we store our exit node counters
export const exitNodeStore = fixtures.createAsyncKeyValStore();

// create responses
const getMockedResponse = async (request: Request): Promise<Message> => {
  const rpcId: number = JSON.parse(request.body)["id"];
  let body: string = "";
  if (request.body.includes("eth_chainId")) {
    body = `{"jsonrpc": "2.0","result": "0x01","id": ${rpcId}}`;
  } else if (request.body.includes("eth_blockNumber")) {
    body = `{"jsonrpc": "2.0","result": "0x17f88c8","id": ${rpcId}}`;
  }

  await fixtures.wait(10);

  const counter = await exitNodeStore
    .get(request.entryNodeDestination)
    .then((v) => BigInt(v || "0"));
  const exitNodeRequest = await Request.fromMessage(
    crypto,
    request.toMessage(),
    EXIT_NODE_PEER_ID,
    EXIT_NODE_WRITE_IDENTITY,
    counter,
    (clientId: string, counter: bigint) => {
      return exitNodeStore.set(clientId, counter.toString());
    }
  );
  const exitNodeResponse = await Response.createResponse(
    crypto,
    exitNodeRequest,
    body
  );

  await fixtures.wait(10);

  return exitNodeResponse.toMessage();
};

export default function mockSdk(sdk: SDK): SDK {
  const originalSendRequest = sdk.sendRequest.bind(sdk);
  sdk.sendRequest = async (request: Request): Promise<Response> => {
    setTimeout(() => {
      getMockedResponse(request).then((responseMessage) => {
        // @ts-ignore
        sdk.onMessage(responseMessage);
      });
    }, 100);
    return originalSendRequest(request);
  };

  return sdk;
}
