import assert from "assert";
import _ from "lodash";
import * as crypto from "@rpch/crypto-for-nodejs";
import Message from "./message";
import Request from "./request";
import { isStringifiedJSON } from "./utils";
import {
  PROVIDER,
  RPC_REQ_SMALL,
  HOPRD_PEER_ID_A as ENTRY_NODE_PEER_ID,
  EXIT_NODE_HOPRD_PEER_ID_A as EXIT_NODE_HOPRD_PEER_ID,
  EXIT_NODE_READ_IDENTITY_A as EXIT_NODE_READ_IDENTITY,
  EXIT_NODE_WRITE_IDENTITY_A as EXIT_NODE_WRITE_IDENTITY,
} from "./fixtures";

const shouldBeAValidRequest = (
  actual: Request,
  expected: Pick<
    Request,
    | "provider"
    | "body"
    | "entryNodeDestination"
    | "exitNodeDestination"
    | "exitNodeIdentity"
  >
) => {
  assert.equal(typeof actual.id, "number");
  assert(actual.id > 0);
  assert.equal(actual.provider, expected.provider);
  let expectedIsStringifiedJSON = isStringifiedJSON(expected.body);
  if (expectedIsStringifiedJSON) {
    const sameMessage = _.isEqual(
      JSON.parse(actual.body),
      JSON.parse(expected.body)
    );
    assert(sameMessage);
  } else {
    assert.equal(actual.body, expected.body);
  }

  assert.equal(actual.entryNodeDestination, expected.entryNodeDestination);
  assert.equal(actual.exitNodeDestination, expected.exitNodeDestination);
  assert(!!actual.exitNodeIdentity);
  assert(!!actual.session);
  assert(actual.session.get_request_data().length > 0);
};

const shouldBeAValidRequestMessage = (
  actual: Message,
  expected: Pick<Message, "id">,
  request: Request
) => {
  assert.equal(actual.id, expected.id);
  const numberOfParts = parseInt(actual.body.split("|")[0]);
  const expectedPrefix =
    `${numberOfParts}|` + request.entryNodeDestination + "|";
  assert(actual.body.startsWith(expectedPrefix));
  assert(actual.body.length > expectedPrefix.length);
};

describe("test Request class", function () {
  it("should create request", async function () {
    const request = await Request.createRequest(
      crypto,
      PROVIDER,
      RPC_REQ_SMALL,
      ENTRY_NODE_PEER_ID,
      EXIT_NODE_HOPRD_PEER_ID,
      EXIT_NODE_READ_IDENTITY
    );

    shouldBeAValidRequest(request, {
      provider: PROVIDER,
      body: RPC_REQ_SMALL,
      entryNodeDestination: ENTRY_NODE_PEER_ID,
      exitNodeDestination: EXIT_NODE_HOPRD_PEER_ID,
      exitNodeIdentity: EXIT_NODE_READ_IDENTITY,
    });
  });

  it("should create message from request", async function () {
    const request = await Request.createRequest(
      crypto,
      PROVIDER,
      RPC_REQ_SMALL,
      ENTRY_NODE_PEER_ID,
      EXIT_NODE_HOPRD_PEER_ID,
      EXIT_NODE_READ_IDENTITY
    );

    shouldBeAValidRequestMessage(
      request.toMessage(),
      { id: request.id },
      request
    );
  });

  it("should create request from message", async function () {
    // created by exit node
    const request = await Request.fromMessage(
      crypto,
      // created by client
      (
        await Request.createRequest(
          crypto,
          PROVIDER,
          RPC_REQ_SMALL,
          ENTRY_NODE_PEER_ID,
          EXIT_NODE_HOPRD_PEER_ID,
          EXIT_NODE_READ_IDENTITY
        )
      ).toMessage(),
      EXIT_NODE_HOPRD_PEER_ID,
      EXIT_NODE_WRITE_IDENTITY,
      BigInt(0),
      () => {}
    );

    shouldBeAValidRequest(request, {
      provider: PROVIDER,
      body: RPC_REQ_SMALL,
      entryNodeDestination: ENTRY_NODE_PEER_ID,
      exitNodeDestination: EXIT_NODE_HOPRD_PEER_ID,
      exitNodeIdentity: EXIT_NODE_WRITE_IDENTITY,
    });
  });
});
