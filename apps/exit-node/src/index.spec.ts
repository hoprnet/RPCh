import assert from "assert";
import { fixtures, Request, Response } from "rpch-commons";
import startExitNode from ".";
const {
  REQUEST_A: MOCKED_REQUEST,
  RESPONSE_A: MOCKED_RESPONSE,
  RESPONSE_BODY,
} = fixtures;

const createMockedSetup = () => {
  let triggerOnMessage: (message: string) => void = () => {};
  const exit = {
    sendRpcRequest: jest.fn(async () => RESPONSE_BODY),
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
    for (const segment of MOCKED_REQUEST.toMessage().toSegments()) {
      triggerOnMessage(segment.toString());
    }

    // Cache should trigger `onRequest` which would then call `sendRpcRequest`
    assert.equal(exit.sendRpcRequest.mock.calls.length, 1);
    // Response is now created, check if Response segments match our mocked Response
    assert.equal(
      hoprd.sendMessage.mock.calls.length,
      MOCKED_RESPONSE.toMessage().toSegments.length
    );
  });
});
