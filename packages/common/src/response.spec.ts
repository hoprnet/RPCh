import assert from "assert";
import Message from "./message";
import type Request from "./request";
import Response from "./response";
import { createMockedFlow, RPC_RES_SMALL } from "./fixtures";

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
    const flow = createMockedFlow();
    const request = flow.next().value as Request;
    const response = Response.createResponse(request, RPC_RES_SMALL);

    shouldBeAValidResponse(response, {
      body: RPC_RES_SMALL,
      entryNode: request.entryNode,
      exitNode: request.exitNode,
    });
  });

  it("should create message from Response", function () {
    const flow = createMockedFlow();
    const request = flow.next().value as Request;
    const response = Response.createResponse(request, RPC_RES_SMALL);

    shouldBeAValidResponseMessage(response.toMessage(), { id: request.id });
  });

  it("should create response from message", async function () {
    const flow = createMockedFlow();
    const clientRequest = flow.next().value as Request;
    flow.next();
    const exitNodeResponse = flow.next().value as Response;

    const clientResponse = Response.fromMessage(
      clientRequest,
      exitNodeResponse.toMessage(),
      BigInt(0),
      () => {}
    );

    shouldBeAValidResponse(clientResponse, {
      body: exitNodeResponse.body,
      entryNode: clientRequest.entryNode,
      exitNode: clientRequest.exitNode,
    });
  });
});
