import assert from "assert";
import startExitNode from ".";
import { fixtures } from "rpch-commons";

const createMockedSetup = () => {
  let triggerOnMessage: (message: string) => void = () => {};
  const exit = {
    sendRpcRequest: jest.fn(async () => fixtures.LARGE_RESPONSE.body),
  };
  const hoprd = {
    sendMessage: jest.fn(async () => "MOCK_SEND_MSG_RESPONSE"),
    createMessageListener: jest.fn(
      async (
        _apiEndpoint: string,
        _apiToken: string,
        onMessage: (message: string) => void
      ) => {
        triggerOnMessage = onMessage;
        return () => {};
      }
    ),
  };

  const stopExitNode = startExitNode({
    exit,
    hoprd,
    apiEndpoint: "",
    apiToken: "",
    timeout: 5e3,
  });

  return {
    triggerOnMessage,
    exit,
    hoprd,
    stopExitNode,
  };
};

describe("test index.ts", function () {
  it("should call all the right methods when a Request is received", function () {
    const { hoprd, exit, triggerOnMessage } = createMockedSetup();

    // send Request segments into Cache
    for (const segment of fixtures.LARGE_REQUEST.toMessage().toSegments()) {
      triggerOnMessage(segment.toString());
    }

    // Cache should trigger `onRequest` which would then call `sendRpcRequest`
    assert.equal(exit.sendRpcRequest.mock.calls.length, 1);
    // Response is now created, check if Response segments match our mocked Response
    assert.equal(
      hoprd.sendMessage.mock.calls.length,
      fixtures.LARGE_RESPONSE.toMessage().toSegments.length
    );
  });
});
