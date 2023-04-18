import assert from "assert";
import * as crypto from "@rpch/crypto-for-nodejs";
import Message from "./message";
import type Request from "./request";
import Response from "./response";
import {
  createMockedFlow,
  generateMockedFlow,
  RPC_RES_SMALL,
} from "./fixtures";

const shouldBeAValidResponse = (
  actual: Response,
  expected: Pick<Response, "body" | "request">
) => {
  assert.equal(typeof actual.id, "number");
  assert(actual.id > 0);
  assert.equal(actual.id, expected.request.id);
  assert.equal(actual.body, expected.body);
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
    const response = Response.createResponse(crypto, request, RPC_RES_SMALL);

    shouldBeAValidResponse(response, {
      body: RPC_RES_SMALL,
      request: request,
    });
  });

  it("should create message from Response", function () {
    const flow = createMockedFlow();
    const request = flow.next().value as Request;
    const response = Response.createResponse(crypto, request, RPC_RES_SMALL);

    shouldBeAValidResponseMessage(response.toMessage(), { id: request.id });
  });

  it("should create response from message", function () {
    const [clientRequest, , exitNodeResponse] = generateMockedFlow(3);

    const clientResponse = Response.fromMessage(
      crypto,
      clientRequest,
      exitNodeResponse.toMessage(),
      BigInt(0),
      () => {}
    );

    shouldBeAValidResponse(clientResponse, {
      body: exitNodeResponse.body,
      request: clientRequest,
    });
  });
});
