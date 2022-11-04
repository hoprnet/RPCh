import assert from "assert";
import Message from "./message";
import Response from "./response";

const RESPONSE = "response";

describe("test Response class", function () {
  it("should create response", function () {
    const response = new Response(13, RESPONSE);
    assert.equal(response.id, 13);
    assert.equal(response.body, RESPONSE);
  });
  it("should create message from response", function () {
    const message = new Response(13, RESPONSE).toMessage();
    assert.equal(message.id, 13);
    assert.equal(message.body, `response|${RESPONSE}`);
  });
  it("should create response from message", function () {
    const response = Response.fromMessage(
      new Message(13, `response|${RESPONSE}`)
    );
    assert.equal(response.body, RESPONSE);
  });
});
