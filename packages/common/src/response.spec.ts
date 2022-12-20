import assert from "assert";
import Message from "./message";
import Response from "./response";
import { Identity } from "./utils";
import {
  createMockedClientRequest,
  createMockedRequestFlow,
  RPC_RES_SMALL,
} from "./fixtures";

const shouldBeAValidResponse = (
  actual: Response,
  expected: Pick<Response, "body" | "entryNode" | "exitNode">
) => {
  assert.equal(typeof actual.id, "number");
  assert(actual.id > 0);
  assert.equal(actual.body, expected.body);
  assert.equal(
    actual.entryNode.peerId.toB58String(),
    expected.entryNode.peerId.toB58String()
  );
  assert.deepEqual(actual.entryNode.pubKey, expected.entryNode.pubKey);
  assert.deepEqual(actual.entryNode.privKey, expected.entryNode.privKey);
  assert.equal(
    actual.exitNode.peerId.toB58String(),
    expected.exitNode.peerId.toB58String()
  );
  assert.deepEqual(actual.exitNode.pubKey, expected.exitNode.pubKey);
  assert.deepEqual(actual.exitNode.privKey, expected.exitNode.privKey);
  assert(!!actual.session);
  assert(actual.session.get_request_data().length > 0);
};

const shouldBeAValidResponseMessage = (
  actual: Message,
  expected: Pick<Message, "id">
) => {
  assert.equal(actual.id, expected.id);
  assert(actual.body.length > 0);
};

describe("test Response class", function () {
  it("should create response from Request", function () {
    const request = createMockedClientRequest();
    const response = Response.createResponse(request, RPC_RES_SMALL);

    shouldBeAValidResponse(response, {
      body: RPC_RES_SMALL,
      entryNode: request.entryNode,
      exitNode: request.exitNode,
    });
  });

  it("should create message from Response", function () {
    const request = createMockedClientRequest();
    const response = Response.createResponse(request, RPC_RES_SMALL);

    shouldBeAValidResponseMessage(response.toMessage(), { id: request.id });
  });

  it("should create response from message", function () {
    const [clientRequest, , exitNodeResponse, clientResponse] =
      createMockedRequestFlow(4);
    shouldBeAValidResponse(clientResponse, {
      body: exitNodeResponse.body,
      entryNode: clientRequest.entryNode,
      // we dont have the private key of the exit node
      exitNode: new Identity(clientRequest.exitNode.peerId.toB58String()),
    });
  });
});
