import assert from "assert";
import * as db from "./";
import { QueryRegisteredNode } from "../registered-node/dto";

const createMockNode = (peerId?: string) =>
  ({
    chainId: 100,
    peerId: peerId ?? "peerId",
    hasExitNode: true,
    honestyScore: 0,
    registeredAt: new Date(Date.now()),
    status: "FRESH",
    totalAmountFunded: 0,
  } as QueryRegisteredNode);

describe("test db functions", function () {
  let dbInstance: db.DBInstance;
  beforeEach(function () {
    dbInstance = {
      data: {
        registeredNodes: [],
      },
    };
  });
  it("should save registered node", async function () {
    const node = createMockNode();
    const savedNode = await db.saveRegisteredNode(dbInstance, node);
    if (!savedNode) throw new Error("Db could not save node");
    const dbNode = await db.getRegisteredNode(dbInstance, node.peerId);
    assert.equal(dbNode?.peerId, node.peerId);
  });
  it("should get all registered nodes", async function () {
    await db.saveRegisteredNode(dbInstance, createMockNode());
    await db.saveRegisteredNode(dbInstance, createMockNode());
    const allNodes = await db.getAllRegisteredNodes(dbInstance);

    assert.equal(allNodes.length, 2);
  });
  it.todo("should get all nodes that are not exit nodes");
  it.todo("should get all nodes that are not exit nodes");
  it("should get one registered node", async function () {
    await db.saveRegisteredNode(dbInstance, createMockNode("1"));
    await db.saveRegisteredNode(dbInstance, createMockNode("2"));
    const node = await db.getRegisteredNode(dbInstance, "1");

    assert.equal(node?.peerId, "1");
  });
  it("should update node", async function () {
    await db.saveRegisteredNode(dbInstance, createMockNode("1"));
    const node = await db.getRegisteredNode(dbInstance, "1");
    if (!node) throw new Error("Db could not save node");

    await db.updateRegisteredNode(dbInstance, { ...node, status: "UNUSABLE" });
    const updatedNode = await db.getRegisteredNode(dbInstance, "1");
    assert.equal(updatedNode?.status, "UNUSABLE");
  });
});
