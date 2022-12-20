import assert from "assert";
import Message from "./message";
import Request from "./request";
import { Identity } from "./utils";
import {
  PROVIDER,
  RPC_REQ_SMALL,
  IDENTITY_A as ENTRY_NODE,
  IDENTITY_B as EXIT_NODE,
} from "./fixtures";

const shouldBeAValidRequest = (
  actual: Request,
  expected: Pick<Request, "provider" | "body" | "entryNode" | "exitNode">
) => {
  assert.equal(typeof actual.id, "number");
  assert(actual.id > 0);
  assert.equal(actual.provider, expected.provider);
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

const shouldBeAValidRequestMessage = (
  actual: Message,
  expected: Pick<Message, "id">,
  request: Request
) => {
  assert.equal(actual.id, expected.id);
  const expectedPrefix = request.entryNode.peerId.toB58String() + "|";
  assert(actual.body.startsWith(expectedPrefix));
  assert(actual.body.length > expectedPrefix.length);
};

describe("test Request class", function () {
  it("should create request", function () {
    const request = Request.createRequest(
      PROVIDER,
      RPC_REQ_SMALL,
      ENTRY_NODE,
      EXIT_NODE
    );

    shouldBeAValidRequest(request, {
      provider: PROVIDER,
      body: RPC_REQ_SMALL,
      entryNode: ENTRY_NODE,
      exitNode: EXIT_NODE,
    });
  });

  it("should create message from request", function () {
    const request = Request.createRequest(
      PROVIDER,
      RPC_REQ_SMALL,
      ENTRY_NODE,
      EXIT_NODE
    );

    shouldBeAValidRequestMessage(
      request.toMessage(),
      { id: request.id },
      request
    );
  });

  it("should create request from message", function () {
    // created by exit node
    const request = Request.fromMessage(
      // created by client
      Request.createRequest(
        PROVIDER,
        RPC_REQ_SMALL,
        ENTRY_NODE,
        EXIT_NODE
      ).toMessage(),
      EXIT_NODE,
      BigInt(0),
      () => {}
    );

    shouldBeAValidRequest(request, {
      provider: PROVIDER,
      body: RPC_REQ_SMALL,
      // we dont have the private key of the entry node
      entryNode: new Identity(ENTRY_NODE.peerId.toB58String()),
      exitNode: EXIT_NODE,
    });
  });
});
