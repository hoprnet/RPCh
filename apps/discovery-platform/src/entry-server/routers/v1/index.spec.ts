import assert from "assert";
import express, { Express } from "express";
import nock from "nock";
import request from "supertest";
import { doesClientHaveQuota, v1Router } from ".";
import { DBInstance } from "../../../db";
import { MockPgInstanceSingleton } from "../../../db/index.spec";
import { FundingServiceApi } from "../../../funding-service-api";
import {
  getAccessTokenResponse,
  postFundingResponse,
} from "../../../funding-service-api/dto";
import * as registeredNode from "../../../registered-node";
import {
  CreateRegisteredNode,
  QueryRegisteredNode,
} from "../../../registered-node/dto";

const FUNDING_SERVICE_URL = "http://localhost:5000";
const BASE_QUOTA = 1;
const FAKE_ACCESS_TOKEN = "EcLjvxdALOT0eq18d8Gzz3DEr3AMG27NtL+++YPSZNE=";

const nockFundingRequest = (nodeAddress: string) =>
  nock(FUNDING_SERVICE_URL).post(`/api/request/funds/${nodeAddress}`);
const nockGetApiAccessToken =
  nock(FUNDING_SERVICE_URL).get("/api/access-token");

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

describe("test v1 router", function () {
  let dbInstance: DBInstance;
  let app: Express;

  beforeAll(async function () {
    dbInstance = MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(async function () {
    MockPgInstanceSingleton.getInitialState().restore();
    const fundingServiceApi = new FundingServiceApi(
      FUNDING_SERVICE_URL,
      dbInstance
    );
    app = express().use(
      "",
      v1Router({
        db: dbInstance,
        baseQuota: BASE_QUOTA,
        fundingServiceApi,
      })
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should register a node", async function () {
    const node = mockNode();
    await request(app).post("/node/register").send(node);
    const createdNode = await request(app).get(`/node/${node.peerId}`);
    assert.equal(createdNode.body.node.id, node.peerId);
  });

  it("should get a node", async function () {
    const node = mockNode();
    await request(app).post("/node/register").send(node);
    await request(app).post("/node/register").send(mockNode("fake"));
    const createdNode = await request(app).get(`/node/${node.peerId}`);
    assert.equal(createdNode.body.node.id, node.peerId);
  });

  it("should get all nodes that are exit node", async function () {
    await request(app).post("/node/register").send(mockNode("notExit1", false));
    await request(app).post("/node/register").send(mockNode("notExit2", false));
    await request(app).post("/node/register").send(mockNode("exit3", true));
    await request(app).post("/node/register").send(mockNode("exit4", true));

    const allExitNodes = await request(app).get(`/node?hasExitNode=true`);

    assert.equal(allExitNodes.body.length, 2);
  });

  it("should get all nodes that are not exit nodes and are not in the exclude list", async function () {
    await request(app).post("/node/register").send(mockNode("notExit1", false));
    await request(app).post("/node/register").send(mockNode("notExit2", false));
    await request(app).post("/node/register").send(mockNode("notExit3", false));
    await request(app).post("/node/register").send(mockNode("exit4", true));

    const allExitNodes = await request(app).get(
      `/node?hasExitNode=${false}&excludeList=notExit2`
    );

    assert.equal(allExitNodes.body.length, 2);
    assert.equal(
      allExitNodes.body.findIndex((node: any) => node.id === "notExit2"),
      -1
    );
  });

  it("should add quota to a client", async function () {
    const createdQuota = await request(app).post("/client/funds").send({
      client: "client",
      quota: 1,
    });
    assert.equal(createdQuota.body.quota.quota, 1);
  });

  it.skip("should not allow request client does not have enough quota", async function () {
    // create quota for client
    await request(app).post("/client/funds").send({
      client: "client",
      quota: 1,
    });
    const doesClientHaveQuotaResponse = await doesClientHaveQuota(
      dbInstance,
      "client",
      2
    );

    assert(!doesClientHaveQuotaResponse);
  });
  it("should allow request because client has enough quota", async function () {
    // create quota for wrong client
    await request(app).post("/client/funds").send({
      client: "client",
      quota: 1,
    });
    const doesClientHaveQuotaResponse = await doesClientHaveQuota(
      dbInstance,
      "client",
      1
    );

    assert(doesClientHaveQuotaResponse);
  });
  describe("should select an entry node", function () {
    it("should return an entry node", async function () {
      const spy = jest.spyOn(registeredNode, "getEligibleNode");
      const amountLeft = 10;
      const peerId = "entry";
      const requestId = 1;

      const replyBody: getAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: 10,
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, replyBody);

      await request(app).post("/client/funds").send({
        client: "client",
        quota: 1,
      });

      await request(app).post("/node/register").send(mockNode(peerId, true));

      const createdNode: {
        body: { node: QueryRegisteredNode | undefined };
      } = await request(app).get(`/node/${peerId}`);

      spy.mockImplementation(async () => {
        return createdNode.body.node;
      });

      let postFundingResponse: postFundingResponse = {
        amountLeft,
        id: requestId,
      };

      nockFundingRequest(createdNode.body.node?.native_address!).reply(
        200,
        postFundingResponse
      );

      const requestResponse = await request(app)
        .post("/request/entry-node")
        .send({ client: "client" });

      assert.equal(requestResponse.body.id, createdNode.body.node?.id);
      spy.mockRestore();
    });
    it("should return an entry node that is not in the exclude list", async function () {
      const amountLeft = 10;
      const peerId = "entry";
      const requestId = 1;

      const replyBody: getAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: 10,
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, replyBody);

      await request(app).post("/client/funds").send({
        client: "client",
        quota: 1,
      });

      await request(app).post("/node/register").send(mockNode(peerId, true));

      await request(app)
        .post("/node/register")
        .send(mockNode(peerId + "2", true));

      const firstCreatedNode: {
        body: { node: QueryRegisteredNode | undefined };
      } = await request(app).get(`/node/${peerId}`);
      const secondCreatedNode: {
        body: { node: QueryRegisteredNode | undefined };
      } = await request(app).get(`/node/${peerId + "2"}`);

      await registeredNode.updateRegisteredNode(dbInstance, {
        ...firstCreatedNode.body.node!,
        status: "READY",
      });
      await registeredNode.updateRegisteredNode(dbInstance, {
        ...secondCreatedNode.body.node!,
        status: "READY",
      });

      let postFundingResponse: postFundingResponse = {
        amountLeft,
        id: requestId,
      };

      nockFundingRequest(secondCreatedNode.body.node?.native_address!).reply(
        200,
        postFundingResponse
      );

      const requestResponse = await request(app)
        .post("/request/entry-node")
        .send({ client: "client", excludeList: ["entry"] });

      assert.equal(requestResponse.body.id, secondCreatedNode.body.node?.id);
    });
    it("should fail if no entry node is selected", async function () {
      const spy = jest.spyOn(registeredNode, "getEligibleNode");

      const apiAccessTokenResponse: getAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: 10,
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, apiAccessTokenResponse);

      await request(app).post("/client/funds").send({
        client: "client",
        quota: 1,
      });

      spy.mockImplementation(async () => undefined);

      const requestResponse = await request(app)
        .post("/request/entry-node")
        .send({ client: "client" });

      assert.equal(requestResponse.body.body, "Could not find eligible node");
      spy.mockRestore();
    });
    it.skip("should reduce client quota", async function () {
      const spy = jest.spyOn(registeredNode, "getEligibleNode");
      const amountLeft = 10;
      const peerId = "entry";
      const requestId = 1;

      const apiTokenResponse: getAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: 10,
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, apiTokenResponse);

      await request(app).post("/client/funds").send({
        client: "newClient",
        quota: BASE_QUOTA,
      });

      await request(app).post("/node/register").send(mockNode(peerId, true));

      const createdNode: {
        body: { node: QueryRegisteredNode | undefined };
      } = await request(app).get(`/node/${peerId}`);

      spy.mockImplementation(async () => {
        return createdNode.body.node;
      });

      const fundingResponse: postFundingResponse = {
        amountLeft,
        id: requestId,
      };

      nockFundingRequest(createdNode.body.node?.native_address!).reply(
        200,
        fundingResponse
      );

      await request(app)
        .post("/request/entry-node")
        .send({ client: "newClient" });

      const requestResponse = await request(app)
        .post("/request/entry-node")
        .send({ client: "newClient" });

      assert.equal(
        requestResponse.body.body,
        "Client does not have enough quota"
      );
      spy.mockRestore();
    });
  });
});
