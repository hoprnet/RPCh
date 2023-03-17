/* eslint-disable @typescript-eslint/no-unused-vars */
import assert from "assert";
import MemDown from "memdown";
import supertest from "supertest";
import { RPCServer } from ".";
import mockSdk from "@rpch/sdk/build/index.mock";

jest.mock("leveldown", () => MemDown);
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

const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
const TIMEOUT = 5e3;

describe("test index.ts", function () {
  let rpcServer: RPCServer;
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(async function () {
    rpcServer = new RPCServer("", TIMEOUT, DISCOVERY_PLATFORM_API_ENDPOINT, "");
    await rpcServer.start();

    // hook to emulate responses from the exit node
    if (!rpcServer.sdk) throw Error("SDK not initialized");
    if (!rpcServer.server) throw Error("Server not initialized");
    rpcServer.sdk = mockSdk(rpcServer.sdk);
    request = supertest(rpcServer.server);
  });

  afterAll(async function () {
    await rpcServer.stop();
  });

  it("should fail when no provider is added", async function () {
    await request
      .post("/")
      .send(JSON.stringify({ id: "1", method: "eth_chainId" }))
      .expect(422);
  });

  it("should get chain id", async function () {
    const response = await request
      .post("/?exit-provider=someprovider")
      .send(JSON.stringify({ id: "1", method: "eth_chainId" }))
      .expect(200);

    const json = JSON.parse(response.text);
    assert.equal(json.result, "0x01");
  });

  it("should get block number", async function () {
    const response = await request
      .post("/?exit-provider=someprovider")
      .send(JSON.stringify({ id: "2", method: "eth_blockNumber" }))
      .expect(200);

    const json = JSON.parse(response.text);
    assert.equal(json.result, "0x17f88c8");
  });
});
