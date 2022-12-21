import assert from "assert";
import { start as startExitNode } from "./index";
import { fixtures } from "rpch-common";
import { utils } from "ethers";

const [clientRequest, , exitNodeResponse] = fixtures.generateMockedFlow(
  3,
  fixtures.RPC_REQ_LARGE,
  undefined,
  fixtures.RPC_RES_LARGE
);

const createMockedSetup = async () => {
  let triggerMessageListenerOnMessage: (message: string) => void = () => {};
  const exit = {
    sendRpcRequest: jest.fn(async () => exitNodeResponse.body),
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
    fetchPeerId: jest.fn(async () => ({
      listeningAddress: [exitNodeResponse.exitNode.peerId.toB58String()] as [
        string
      ],
    })),
  };

  const stopExitNode = await startExitNode({
    exit,
    hoprd,
    privateKey: utils.hexlify(exitNodeResponse.exitNode.privKey!),
    apiEndpoint: "",
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
    const { hoprd, exit, triggerMessageListenerOnMessage, stopExitNode } =
      await createMockedSetup();

    // send Request segments into Cache
    for (const segment of clientRequest.toMessage().toSegments()) {
      triggerMessageListenerOnMessage(segment.toString());
    }

    // Cache should trigger `onMessage` which would then call `sendRpcRequest`
    assert.equal(exit.sendRpcRequest.mock.calls.length, 1);
    // // Response is now created, check if Response segments match our mocked Response
    // assert.equal(
    //   hoprd.sendMessage.mock.calls.length,
    // );
    // console.log(hoprd.sendMessage.mock);
    // console.log(exitNodeResponse.toMessage().toSegments().length);

    stopExitNode();
  });
});
