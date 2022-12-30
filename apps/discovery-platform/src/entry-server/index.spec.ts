import assert from "assert";
import { DBInstance } from "../db";
import request from "supertest";
import { Express } from "express";
import { doesClientHaveQuota, entryServer } from ".";
import { CreateRegisteredNode } from "../registered-node/dto";
import { FundingPlatformApi } from "../funding-platform-api";

const FUNDING_PLATFORM_URL = "http://localhost:5000";

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
        quotas: [],
      },
    };
    const fundingPlatformApi = new FundingPlatformApi(FUNDING_PLATFORM_URL, db);
    app = entryServer({ db, baseQuota: 1, fundingPlatformApi });
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

  it("should add quota to a client", async function () {
    const createdQuota = await request(app).post("/api/client/funds").send({
      client: "client",
      quota: 1,
    });
    assert.equal(createdQuota.body.quota.quota, 1);
  });

  it("should check if client has enough quota", async function () {
    jest.mock("../quota", () => ({
      ...jest.requireActual("../quota"),
      sumQuotas: () => 0,
    }));

    const doesClientHaveQuotaResponse = await doesClientHaveQuota(
      db,
      "client",
      1
    );

    assert(!doesClientHaveQuotaResponse);
  });
  it.todo("should get a honest entry node");
  it.todo("should fund entry node");
});
