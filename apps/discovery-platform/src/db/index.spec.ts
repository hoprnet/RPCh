import assert from "assert";
import { QueryRegisteredNode } from "../registered-node/dto";
import * as db from "./";
import { QueryQuota } from "../quota/dto";

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

const createMockQuota = (params?: QueryQuota): QueryQuota => {
  return {
    id: params?.id ?? Math.floor(Math.random() * 100),
    action_taker: params?.action_taker ?? "discovery-platform",
    client: params?.client ?? "client",
    quota: params?.quota ?? 1,
  };
};

describe("test db functions", function () {
  let dbInstance: db.DBInstance;
  beforeEach(function () {
    dbInstance = {
      data: {
        registeredNodes: [],
        quotas: [],
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
  it("should create quota", async function () {
    const mockQuota = createMockQuota();
    const quota = await db.createQuota(dbInstance, mockQuota);
    assert.equal(quota.id, mockQuota.id);
  });
  it("should get quota by id", async function () {
    const mockQuota = createMockQuota();
    await db.createQuota(dbInstance, mockQuota);
    await db.createQuota(dbInstance, createMockQuota());
    const queryQuota = await db.getQuota(dbInstance, mockQuota.id ?? 0);
    assert.equal(queryQuota?.id, mockQuota.id);
  });
  it("should get quotas by client", async function () {
    const mockQuota = createMockQuota({
      client: "client",
      action_taker: "discovery",
      quota: 10,
    });
    await db.createQuota(dbInstance, mockQuota);
    await db.createQuota(dbInstance, mockQuota);
    await db.createQuota(
      dbInstance,
      createMockQuota({
        action_taker: "discovery",
        client: "other client",
        quota: 20,
      })
    );

    const quotas = await db.getAllQuotasByClient(dbInstance, "client");
    assert.equal(quotas.length, 2);
  });
  it("should update quota", async function () {
    const mockQuota = createMockQuota({
      client: "client",
      action_taker: "discovery",
      quota: 10,
    });
    await db.createQuota(dbInstance, mockQuota);
    await db.updateQuota(dbInstance, { ...mockQuota, action_taker: "eve" });
    const updatedQuota = await db.getQuota(dbInstance, mockQuota.id ?? 0);
    assert.equal(updatedQuota?.action_taker, "eve");
  });
  it("should delete quota", async function () {
    const mockQuota = createMockQuota({
      client: "client",
      action_taker: "discovery",
      quota: 10,
    });
    await db.createQuota(dbInstance, mockQuota);
    if (!mockQuota.id) throw new Error("Could not create mock quota");
    await db.deleteQuota(dbInstance, mockQuota.id);
    const deletedQuota = await db.getQuota(dbInstance, mockQuota.id ?? 0);
    assert.equal(deletedQuota, undefined);
  });
});
