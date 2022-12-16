import assert from "assert";
import { CreateRegisteredNode } from "./dto";
import {
  createRegisteredNode,
  getAllRegisteredNodes,
  getRegisteredNode,
  updateRegisteredNode,
} from ".";
import { DBInstance } from "../db";

const mockNode = (peerId?: string) =>
  ({
    hasExitNode: true,
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

    const allNodes = await getAllRegisteredNodes(db);

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
  it.todo("should get all nodes that are not exit nodes");
  it.todo("should get all nodes that are not exit nodes");
});
