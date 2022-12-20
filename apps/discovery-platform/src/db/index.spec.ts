import assert from "assert";
import { QueryRegisteredNode } from "../registered-node/dto";
import * as db from "./";

const createMockNode = (peerId?: string, hasExitNode?: boolean) =>
  ({
    chainId: 100,
    peerId: peerId ?? "peerId",
    hasExitNode: hasExitNode ?? true,
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
  it("should get all nodes that are not exit nodes", async function () {
    const firstNode = createMockNode("peer1", false);
    await db.saveRegisteredNode(dbInstance, firstNode);
    const secondNode = createMockNode("peer1", false);
    await db.saveRegisteredNode(dbInstance, secondNode);
    await db.saveRegisteredNode(dbInstance, createMockNode());

    const notExitNodes = await db.getAllNonExitNodes(dbInstance);

    assert.equal(notExitNodes.length, 2);
  });
  it("should get all nodes that are not exit nodes", async function () {
    const firstNode = createMockNode("peer1", true);
    await db.saveRegisteredNode(dbInstance, firstNode);
    const secondNode = createMockNode("peer1", true);
    await db.saveRegisteredNode(dbInstance, secondNode);
    await db.saveRegisteredNode(dbInstance, createMockNode("peer2", false));

    const exitNodes = await db.getAllExitNodes(dbInstance);

    assert.equal(exitNodes.length, 2);
  });
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
