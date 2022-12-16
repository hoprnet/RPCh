import assert from "assert";
import { DBInstance } from "../db";
import request from "supertest";
import { Express } from "express";
import { entryServer } from ".";
import { CreateRegisteredNode } from "../registered-node/dto";

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

describe("test entry server", function () {
  let db: DBInstance;
  let app: Express;
  beforeEach(function () {
    db = {
      data: {
        registeredNodes: [],
      },
    };
    app = entryServer({ db });
  });

  it("should register a node", async function () {
    const node = mockNode();
    await request(app).post("/api/node/register").send(node);
    const createdNode = await request(app).get(`/api/node/${node.peerId}`);
    assert.equal(createdNode.body.node.peerId, node.peerId);
  });

  it("should get a node", async function () {
    const node = mockNode();
    await request(app).post("/api/node/register").send(node);
    await request(app).post("/api/node/register").send(mockNode("fake"));
    const createdNode = await request(app).get(`/api/node/${node.peerId}`);
    assert.equal(createdNode.body.node.peerId, node.peerId);
  });

  it("should get all nodes", async function () {
    await request(app)
      .post("/api/node/register")
      .send(mockNode("notExit1", false));
    await request(app)
      .post("/api/node/register")
      .send(mockNode("notExit2", false));
    await request(app).post("/api/node/register").send(mockNode("exit3", true));
    await request(app).post("/api/node/register").send(mockNode("exit4", true));

    const allExitNodes = await request(app).get(
      `/api/node?hasExitNode=${false}`
    );

    assert(typeof allExitNodes.body === "object" && allExitNodes.body.length);
  });
});
