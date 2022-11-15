import assert from "assert";
import Message from "./message";
import Request from "./request";
import { RPC_REQ_SMALL, PEER_ID_A as ORIGIN, PROVIDER } from "./fixtures";

describe("test Request class", function () {
  it("should create request", function () {
    const request = new Request(13, ORIGIN, PROVIDER, RPC_REQ_SMALL);
    assert.equal(request.id, 13);
    assert.equal(request.body, RPC_REQ_SMALL);
    assert.equal(request.origin, ORIGIN);
    assert.equal(request.provider, PROVIDER);
  });
  it("should create request from data", function () {
    const request = Request.fromData(ORIGIN, PROVIDER, RPC_REQ_SMALL);
    assert.equal(request.body, RPC_REQ_SMALL);
    assert.equal(request.origin, ORIGIN);
    assert.equal(request.provider, PROVIDER);
  });
  it("should create message from request", function () {
    const message = new Request(
      13,
      ORIGIN,
      PROVIDER,
      RPC_REQ_SMALL
    ).toMessage();
    assert.equal(message.id, 13);
    assert.equal(
      message.body,
      `request|${ORIGIN}|${PROVIDER}|${RPC_REQ_SMALL}`
    );
  });
  it("should create request from message", function () {
    const request = Request.fromMessage(
      new Message(13, `request|${ORIGIN}|${PROVIDER}|${RPC_REQ_SMALL}`)
    );
    assert.equal(request.body, RPC_REQ_SMALL);
    assert.equal(request.origin, ORIGIN);
    assert.equal(request.provider, PROVIDER);
  });
  it("should create response from request", function () {
    const response = new Request(
      13,
      ORIGIN,
      PROVIDER,
      RPC_REQ_SMALL
    ).createResponse("response");
    assert.equal(response.id, 13);
    assert.equal(response.body, "response");
  });
});
