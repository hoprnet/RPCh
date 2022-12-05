import assert from "assert";
import Response from "./response";
import { SMALL_REQUEST as MOCK_REQUEST, RPC_RES_SMALL } from "./fixtures";

describe("test Response class", function () {
  const MOCK_RESPONSE = MOCK_REQUEST.createResponse(RPC_RES_SMALL);

  it("should create response", function () {
    assert.equal(MOCK_RESPONSE.id, MOCK_REQUEST.id);
    assert.equal(MOCK_RESPONSE.body, RPC_RES_SMALL);
    assert.equal(MOCK_RESPONSE.entryNode, MOCK_REQUEST.entryNode);
    assert.equal(MOCK_RESPONSE.exitNode, MOCK_REQUEST.exitNode);
    assert(!!MOCK_RESPONSE.session);
    assert(MOCK_RESPONSE.session.get_request_data().length > 0);
  });

  it("should create message from response", function () {
    const message = MOCK_RESPONSE.toMessage();
    assert.equal(message.id, 13);
    assert.equal(
      message.body,
      `${MOCK_REQUEST.exitNode.peerId.toB58String()}|${new TextDecoder().decode(
        MOCK_RESPONSE.session.get_response_data()
      )}`
    );
  });

  it("should create response from Request", function () {
    const response = Response.fromRequest(MOCK_REQUEST, RPC_RES_SMALL);

    assert.equal(response.id, MOCK_REQUEST.id);
    assert.equal(response.body, RPC_RES_SMALL);
    assert.equal(response.entryNode, MOCK_REQUEST.entryNode);
    assert.equal(response.exitNode, MOCK_REQUEST.exitNode);
    assert(!!response.session);
    assert(response.session.get_request_data().length > 0);
  });
});
