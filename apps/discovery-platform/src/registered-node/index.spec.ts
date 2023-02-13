import assert from "assert";
import {
  createRegisteredNode,
  getRegisteredNodes,
  getRegisteredNode,
  updateRegisteredNode,
  getEligibleNode,
  getRewardForNode,
} from ".";
import { DBInstance } from "../db";
import { CreateRegisteredNode } from "./dto";
import { MockPgInstanceSingleton } from "../db/index.spec";

const mockNode = (
  peerId?: string,
  hasExitNode?: boolean
): CreateRegisteredNode => ({
  hasExitNode: hasExitNode ?? true,
  peerId: peerId ?? "peerId",
  chainId: 100,
  hoprdApiEndpoint: "localhost:5000",
  hoprdApiToken: "someToken",
  exitNodePubKey: "somePubKey",
  nativeAddress: "someAddress",
});

describe("test registered node functions", function () {
  let dbInstance: DBInstance;

  beforeAll(async function () {
    dbInstance = MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(async function () {
    MockPgInstanceSingleton.getInitialState().restore();
  });

  it("should save registered node", async function () {
    const mockedNode = await createRegisteredNode(dbInstance, mockNode());
    if (!mockedNode) throw new Error("Failed to create node");
    const createdNode = await getRegisteredNode(dbInstance, mockNode().peerId);
    assert.equal(createdNode?.id, mockNode().peerId);
  });
  it("should get all registered nodes", async function () {
    await createRegisteredNode(dbInstance, mockNode("1"));
    await createRegisteredNode(dbInstance, mockNode("2"));

    const allNodes = await getRegisteredNodes(dbInstance);

    assert.equal(allNodes.length, 2);
  });
  it("should get all registered nodes except exclude list", async function () {
    await createRegisteredNode(dbInstance, mockNode("1"));
    await createRegisteredNode(dbInstance, mockNode("2"));
    await createRegisteredNode(dbInstance, mockNode("3"));

    const notExcludedNodes = await getRegisteredNodes(dbInstance, {
      excludeList: ["2"],
    });

    assert.equal(notExcludedNodes.length, 2);
    assert.equal(
      notExcludedNodes.findIndex((node) => node.id === "2"),
      -1
    );
  });
  it("should get one registered node", async function () {
    await createRegisteredNode(dbInstance, mockNode("1"));
    await createRegisteredNode(dbInstance, mockNode("2"));

    const node = await getRegisteredNode(dbInstance, "1");

    assert.equal(node?.id, "1");
  });
  it("should update registered node", async function () {
    await createRegisteredNode(dbInstance, mockNode("1"));
    const node = await getRegisteredNode(dbInstance, "1");
    if (!node) throw new Error("Failed to create node");
    await updateRegisteredNode(dbInstance, { ...node, status: "READY" });
    const updatedNode = await getRegisteredNode(dbInstance, "1");
    assert.equal(updatedNode?.status, "READY");
  });
  it("should get all nodes that are not exit nodes", async function () {
    await createRegisteredNode(dbInstance, mockNode("1", false));
    await createRegisteredNode(dbInstance, mockNode("2", true));
    await createRegisteredNode(dbInstance, mockNode("3", false));
    const notExitNodes = await getRegisteredNodes(dbInstance, {
      hasExitNode: false,
    });

    assert.equal(notExitNodes.length, 2);
  });
  it("should get all nodes that are exit nodes", async function () {
    await createRegisteredNode(dbInstance, mockNode("1", false));
    await createRegisteredNode(dbInstance, mockNode("2", true));
    await createRegisteredNode(dbInstance, mockNode("3", true));
    const exitNodes = await getRegisteredNodes(dbInstance, {
      hasExitNode: true,
    });

    assert.equal(exitNodes.length, 2);
  });
  it("should get all fresh nodes", async function () {
    await createRegisteredNode(dbInstance, mockNode("1"));
    const node = await getRegisteredNode(dbInstance, "1");
    if (!node) throw new Error("Failed to create node");
    await updateRegisteredNode(dbInstance, { ...node, status: "READY" });
    const updatedNode = await getRegisteredNode(dbInstance, "1");
    await createRegisteredNode(dbInstance, mockNode("2", true));
    await createRegisteredNode(dbInstance, mockNode("3", true));

    const freshNodes = await getRegisteredNodes(dbInstance, {
      status: "FRESH",
    });

    assert.equal(freshNodes?.length, 2);
  });
  it("should get eligible node", async function () {
    await createRegisteredNode(dbInstance, mockNode("1", false));
    await createRegisteredNode(dbInstance, mockNode("2", true));
    await createRegisteredNode(dbInstance, mockNode("3", true));

    const queryNode = await getRegisteredNode(dbInstance, "2");
    if (!queryNode) throw new Error("Could not query in registered node test");

    const updateNode = await updateRegisteredNode(dbInstance, {
      ...queryNode,
      status: "READY",
    });

    const eligibleNode = await getEligibleNode(dbInstance);

    assert.equal(eligibleNode?.id, queryNode?.id);
    assert.equal(eligibleNode?.status, "READY");
  });
  it("should calculate reward for non exit node", async function () {
    const baseQuota = BigInt(1);
    await createRegisteredNode(dbInstance, mockNode("1", false));
    const nonExit = await getRegisteredNode(dbInstance, "1");
    if (!nonExit) throw new Error("Failed to create non exit node in test");

    const reward = getRewardForNode(baseQuota, BigInt(0.1), nonExit);

    assert.equal(reward, baseQuota + BigInt(0.1));
  });
  it("should calculate reward for exit node", async function () {
    const baseQuota = BigInt(1);
    await createRegisteredNode(dbInstance, mockNode("1", true));
    const nonExit = await getRegisteredNode(dbInstance, "1");
    if (!nonExit) throw new Error("Failed to create non exit node in test");

    const reward = getRewardForNode(baseQuota, BigInt(0.1), nonExit);

    assert.equal(reward, baseQuota + BigInt(0.1) * BigInt(2));
  });
  it.todo("should get a access token");
});
