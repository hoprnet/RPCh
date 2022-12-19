import assert from "assert";
import Response from "./response";
import {
  PROVIDER,
  RPC_REQ_SMALL,
  RPC_RES_SMALL,
  IDENTITY_A,
  IDENTITY_B,
} from "./fixtures";
import Request from "./request";

describe("test Response class", function () {
  let MOCK_REQUEST: Request;

  beforeEach(function () {
    MOCK_REQUEST = Request.createRequest(
      PROVIDER,
      RPC_REQ_SMALL,
      IDENTITY_A,
      IDENTITY_B
    );
  });

  it("should create response from Request", function () {
    const response = Response.createResponse(MOCK_REQUEST, RPC_RES_SMALL);

    assert.equal(response.id, MOCK_REQUEST.id);
    assert.equal(response.body, RPC_RES_SMALL);
    assert.equal(response.entryNode, MOCK_REQUEST.entryNode);
    assert.equal(response.exitNode, MOCK_REQUEST.exitNode);
    assert(!!response.session);
    assert(response.session.get_request_data().length > 0);
  });

  it("should create message from Response", function () {
    const response = Response.createResponse(MOCK_REQUEST, RPC_RES_SMALL);

    const message = response.toMessage();
    assert.equal(message.id, response.id);
    assert(message.body.length > 0);
  });

  it("should create response from message", async function () {
    const wait = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // client
    const clientRequest = Request.createRequest(
      PROVIDER,
      RPC_REQ_SMALL,
      IDENTITY_A,
      IDENTITY_B
    );

    await wait(2);

    // exit node
    const exitNodeRequest = Request.fromMessage(
      clientRequest.toMessage(),
      IDENTITY_B,
      BigInt(0),
      () => {}
    );
    const exitNodeResponse = Response.createResponse(
      exitNodeRequest,
      RPC_RES_SMALL
    );

    await wait(2);

    // client
    const response = Response.fromMessage(
      clientRequest,
      exitNodeResponse.toMessage(),
      BigInt(0),
      () => {}
    );

    assert.equal(response.id, clientRequest.id);
    assert.equal(response.body, RPC_RES_SMALL);
    assert.equal(response.entryNode, clientRequest.entryNode);
    assert.equal(response.exitNode, clientRequest.exitNode);
    assert(!!response.session);
    assert(response.session.get_request_data().length > 0);
  });
});
