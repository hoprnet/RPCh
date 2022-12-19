import assert from "assert";
import Request from "./request";
import {
  PROVIDER,
  RPC_REQ_SMALL,
  RPC_RES_SMALL,
  IDENTITY_A,
  IDENTITY_B,
} from "./fixtures";

describe("test Request class", function () {
  it("should create request", function () {
    const REQUEST_MOCK = Request.createRequest(
      PROVIDER,
      RPC_REQ_SMALL,
      IDENTITY_A,
      IDENTITY_B
    );

    assert.equal(typeof REQUEST_MOCK.id, "number");
    assert(REQUEST_MOCK.id > 0);
    assert.equal(REQUEST_MOCK.body, RPC_REQ_SMALL);
    assert.equal(REQUEST_MOCK.provider, PROVIDER);
    assert.equal(REQUEST_MOCK.entryNode, IDENTITY_A);
    assert.equal(REQUEST_MOCK.exitNode, IDENTITY_B);
    assert(!!REQUEST_MOCK.session);
    assert(REQUEST_MOCK.session.get_request_data().length > 0);
  });

  it("should create message from request", function () {
    const REQUEST_MOCK = Request.createRequest(
      PROVIDER,
      RPC_REQ_SMALL,
      IDENTITY_A,
      IDENTITY_B
    );

    const message = REQUEST_MOCK.toMessage();
    assert.equal(message.id, REQUEST_MOCK.id);
    assert(message.body.startsWith(IDENTITY_A.peerId.toB58String() + "|"));
  });

  it("should create request from message", function () {
    const REQUEST_MOCK = Request.createRequest(
      PROVIDER,
      RPC_REQ_SMALL,
      IDENTITY_A,
      IDENTITY_B
    );
    const message = REQUEST_MOCK.toMessage();
    const request = Request.fromMessage(message, IDENTITY_B);
    assert.equal(typeof request.id, "number");
    assert(request.id > 0);
    assert.equal(request.body, RPC_REQ_SMALL);
    assert.equal(request.provider, PROVIDER);
    assert.equal(
      request.entryNode.peerId.toB58String(),
      IDENTITY_A.peerId.toB58String()
    );
    assert.equal(
      request.exitNode.peerId.toB58String(),
      IDENTITY_B.peerId.toB58String()
    );
    assert(!!request.session);
    assert(request.session.get_request_data().length > 0);
  });

  it("should create response from request", function () {
    const REQUEST_MOCK = Request.createRequest(
      PROVIDER,
      RPC_REQ_SMALL,
      IDENTITY_A,
      IDENTITY_B
    );

    const response = REQUEST_MOCK.createResponse(RPC_RES_SMALL);
    assert.equal(response.id, REQUEST_MOCK.id);
    assert.equal(typeof response.body, "string");
  });
});
