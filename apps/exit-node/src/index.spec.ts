import assert from "assert";
import * as fixtures from "@rpch/common/build/fixtures";
import MemDown from "memdown";
import { utils } from "ethers";
import { start as startExitNode } from "./index";

jest.mock("leveldown", () => MemDown);

const [clientRequest, , exitNodeResponse] = fixtures.generateMockedFlow(
  3,
  fixtures.RPC_REQ_LARGE,
  undefined,
  fixtures.RPC_RES_LARGE
);

const createMockedSetup = async () => {
  let triggerMessageListenerOnMessage: (message: string) => void = () => {};
  const exit = {
    sendRpcRequest: jest.fn(async () => {
      return exitNodeResponse.body;
    }),
  };
  const hoprd = {
    sendMessage: jest.fn(async () => "MOCK_SEND_MSG_RESPONSE"),
    createMessageListener: jest.fn(
      async (
        _apiEndpoint: string,
        _apiToken: string,
        onMessage: (message: string) => void
      ) => {
        triggerMessageListenerOnMessage = onMessage;
        return () => {};
      }
    ),
    fetchPeerId: jest.fn(
      async () => exitNodeResponse.request.exitNodeDestination
    ),
  };

  const stopExitNode = await startExitNode({
    exit,
    hoprd,
    privateKey: utils.arrayify(fixtures.EXIT_NODE_PRIV_KEY_A),
    identityFile: "",
    password: "",
    dataDir: "",
    apiEndpoint: "http://entry_node",
    apiToken: "",
    timeout: 5e3,
  });

  return {
    triggerMessageListenerOnMessage,
    exit,
    hoprd,
    stopExitNode,
  };
};

describe("test index.ts", function () {
  it("should call all the right methods when a Request is received", async function () {
    const mock = await createMockedSetup();

    // send Request segments into Cache
    for (const segment of clientRequest.toMessage().toSegments()) {
      mock.triggerMessageListenerOnMessage(segment.toString());
    }

    // wait for sendRpcRequest to be called
    while (mock.exit.sendRpcRequest.mock.calls.length === 0) {
      await fixtures.wait(1);
    }

    // Cache should trigger `onMessage` which would then call `sendRpcRequest`
    assert.equal(mock.exit.sendRpcRequest.mock.calls.length, 1);
    // Response is now created, check if Response segments match our mocked Response
    assert.equal(
      mock.hoprd.sendMessage.mock.calls.length,
      clientRequest.toMessage().toSegments().length
    );

    mock.stopExitNode();
  });
});
