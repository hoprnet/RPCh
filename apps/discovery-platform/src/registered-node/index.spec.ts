import assert from "assert";
import {
  createRegisteredNode,
  getExitNodes,
  getNonExitNodes,
  getRegisteredNodes,
  getRegisteredNode,
  updateRegisteredNode,
} from ".";
import { DBInstance } from "../db";
import { CreateRegisteredNode } from "./dto";

const mockNode = (peerId?: string, hasExitNode?: boolean) =>
  ({
    hasExitNode: hasExitNode ?? true,
    peerId: peerId ?? "peerId",
    chainId: 100,
    ports: {
      exitNodePort: 3000,
      hoprApiEndpoint: "localhost",
      hoprApiPort: 5000,
    },
  } as CreateRegisteredNode);

describe("test registered node functions", function () {
  let db: DBInstance;
  beforeEach(function () {
    db = {
      data: {
        registeredNodes: [],
        quotas: [],
      },
    };
  });

  it("should save registered node", async function () {
    const mockedNode = await createRegisteredNode(db, mockNode());
    if (!mockedNode) throw new Error("Failed to create node");
    const createdNode = await getRegisteredNode(db, mockNode().peerId);
    assert.equal(createdNode?.peerId, mockNode().peerId);
  });
  it("should get all registered node", async function () {
    await createRegisteredNode(db, mockNode());
    await createRegisteredNode(db, mockNode());

    const allNodes = await getRegisteredNodes(db);

    assert.equal(allNodes.length, 2);
  });
  it("should get one registered node", async function () {
    await createRegisteredNode(db, mockNode("1"));
    await createRegisteredNode(db, mockNode("2"));

    const node = await getRegisteredNode(db, "1");

    assert.equal(node?.peerId, "1");
  });
  it("should update registered node", async function () {
    await createRegisteredNode(db, mockNode("1"));
    const node = await getRegisteredNode(db, "1");
    if (!node) throw new Error("Failed to create node");
    await updateRegisteredNode(db, { ...node, status: "READY" });
    const updatedNode = await getRegisteredNode(db, "1");
    assert.equal(updatedNode?.status, "READY");
  });
  it("should get all nodes that are not exit nodes", async function () {
    await createRegisteredNode(db, mockNode("1", false));
    await createRegisteredNode(db, mockNode("2", true));
    await createRegisteredNode(db, mockNode("3", false));
    const notExitNodes = await getNonExitNodes(db);

    assert.equal(notExitNodes.length, 2);
  });
  it("should get all nodes that are exit nodes", async function () {
    await createRegisteredNode(db, mockNode("1", false));
    await createRegisteredNode(db, mockNode("2", true));
    await createRegisteredNode(db, mockNode("3", true));
    const exitNodes = await getExitNodes(db);

    assert.equal(exitNodes.length, 2);
  });
  it.todo("should get a access token");
});
