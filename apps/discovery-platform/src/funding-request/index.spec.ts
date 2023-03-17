import assert from "assert";
import { FundingServiceApi } from "../funding-service-api";
import * as db from "../db";
import { MockPgInstanceSingleton } from "../db/index.spec";
import { createRegisteredNode, getRegisteredNode } from "../registered-node";
import { RegisteredNode } from "../types";
import { createFundingRequest } from ".";

const mockNode = (peerId?: string, hasExitNode?: boolean): RegisteredNode => ({
  hasExitNode: hasExitNode ?? true,
  peerId: peerId ?? "peerId",
  chainId: 100,
  hoprdApiEndpoint: "localhost:5000",
  hoprdApiToken: "someToken",
  exitNodePubKey: "somePubKey",
  nativeAddress: "someAddress",
});

describe("test funding requests functions", function () {
  let dbInstance: db.DBInstance;

  beforeAll(async function () {
    dbInstance = await MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(function () {
    MockPgInstanceSingleton.getInitialState().restore();
  });

  it("should save funding request", async function () {
    await createRegisteredNode(dbInstance, mockNode());
    const createdNode = await getRegisteredNode(dbInstance, mockNode().peerId);

    const createdFundedRequest = await createFundingRequest(dbInstance, {
      amount: BigInt("1"),
      registeredNodeId: createdNode.id,
      requestId: Math.floor(Math.random() * 1e6),
    });

    assert.equal(createdFundedRequest?.registered_node_id, createdNode.id);
  });
});
