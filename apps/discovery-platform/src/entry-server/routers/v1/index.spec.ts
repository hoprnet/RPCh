import assert from "assert";
import express, { Express, NextFunction, Request, Response } from "express";
import nock from "nock";
import request from "supertest";
import {
  doesClientHaveQuota,
  getCache,
  requestDurationMiddleware,
  setCache,
  v1Router,
} from ".";
import { getClient } from "../../../client";
import { DBInstance } from "../../../db";
import { MockPgInstanceSingleton } from "../../../db/index.spec";
import { FundingServiceApi } from "../../../funding-service-api";
import {
  getSumOfQuotasUsedByClient,
  getSumOfQuotasPaidByClient,
} from "../../../quota";
import * as registeredNode from "../../../registered-node";
import Prometheus from "prom-client";
import {
  RegisteredNode,
  RegisteredNodeDB,
  GetAccessTokenResponse,
  PostFundingResponse,
} from "../../../types";
import memoryCache from "memory-cache";

const FUNDING_SERVICE_URL = "http://localhost:5000";
const BASE_QUOTA = BigInt(1);
const FAKE_ACCESS_TOKEN = "EcLjvxdALOT0eq18d8Gzz3DEr3AMG27NtL+++YPSZNE=";

const nockFundingRequest = (nodeAddress: string) =>
  nock(FUNDING_SERVICE_URL).post(`/api/request/funds/${nodeAddress}`);
const nockGetApiAccessToken =
  nock(FUNDING_SERVICE_URL).get("/api/access-token");

const mockNode = (peerId?: string, hasExitNode?: boolean): RegisteredNode => ({
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
    dbInstance = await MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(async function () {
    MockPgInstanceSingleton.getInitialState().restore();
    const fundingServiceApi = new FundingServiceApi(
      FUNDING_SERVICE_URL,
      dbInstance
    );
    const register = new Prometheus.Registry();
    app = express().use(
      "",
      v1Router({
        db: dbInstance,
        baseQuota: BASE_QUOTA,
        fundingServiceApi,
        register: register,
      })
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
    memoryCache.clear();
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
    const createdQuota = await request(app).post("/client/quota").send({
      client: "client",
      quota: 1,
    });
    assert.equal(createdQuota.body.quota.quota, 1);
  });

  it("should not allow request client does not have enough quota", async function () {
    // create quota for client
    await request(app).post("/client/quota").send({
      client: "client",
      quota: 1,
    });
    const doesClientHaveQuotaResponse = await doesClientHaveQuota(
      dbInstance,
      "client",
      BigInt(2)
    );

    assert.equal(doesClientHaveQuotaResponse, false);
  });
  it("should allow request because client has enough quota", async function () {
    // create quota client
    await request(app).post("/client/quota").send({
      client: "client",
      quota: 1,
    });
    const doesClientHaveQuotaResponse = await doesClientHaveQuota(
      dbInstance,
      "client",
      BigInt(1)
    );

    assert.equal(doesClientHaveQuotaResponse, true);
  });
  it("should create trial client", async function () {
    const response = await request(app).get(
      "/request/trial?label=devcon,some-dash"
    );
    const dbClient = await getClient(dbInstance, response.body.client);
    assert.equal(dbClient?.payment, "trial");
    assert.deepEqual(dbClient?.labels, ["devcon", "some-dash"]);
    assert.equal(!!response.body.client, true);
  });
  it("should turn client into premium when adding quota", async function () {
    const spy = jest.spyOn(registeredNode, "getEligibleNode");

    const responseRequestTrialClient = await request(app).get("/request/trial");
    const trialClientId: string = responseRequestTrialClient.body.client;

    await request(app)
      .post("/client/quota")
      .send({ client: trialClientId, quota: BASE_QUOTA.toString() });

    const dbTrialClientAfterAddingQuota = await getClient(
      dbInstance,
      trialClientId
    );

    expect(dbTrialClientAfterAddingQuota?.payment).toEqual("premium");
    spy.mockRestore();
  });
  describe("should select an entry node", function () {
    it("should return an entry node", async function () {
      const spy = jest.spyOn(registeredNode, "getEligibleNode");
      const amountLeft = BigInt(10).toString();
      const peerId = "entry";
      const requestId = 1;

      const replyBody: GetAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: BigInt(10).toString(),
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, replyBody);
      await request(app)
        .post("/client/quota")
        .send({
          client: "client",
          quota: BigInt("1").toString(),
        });

      await request(app).post("/node/register").send(mockNode(peerId, true));

      const createdNode: {
        body: { node: RegisteredNodeDB | undefined };
      } = await request(app).get(`/node/${peerId}`);

      spy.mockImplementation(async () => {
        return createdNode.body.node;
      });

      let postFundingResponse: PostFundingResponse = {
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
      const amountLeft = BigInt(10).toString();
      const peerId = "entry";
      const requestId = 1;

      const replyBody: GetAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: BigInt(10).toString(),
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, replyBody);
      await request(app).post("/client/quota").send({
        client: "client",
        quota: 1,
      });

      await request(app).post("/node/register").send(mockNode(peerId, true));

      await request(app)
        .post("/node/register")
        .send(mockNode(peerId + "2", true));

      const firstCreatedNode: {
        body: { node: RegisteredNodeDB | undefined };
      } = await request(app).get(`/node/${peerId}`);
      const secondCreatedNode: {
        body: { node: RegisteredNodeDB | undefined };
      } = await request(app).get(`/node/${peerId + "2"}`);

      await registeredNode.updateRegisteredNode(dbInstance, {
        ...firstCreatedNode.body.node!,
        status: "READY",
      });
      await registeredNode.updateRegisteredNode(dbInstance, {
        ...secondCreatedNode.body.node!,
        status: "READY",
      });

      let postFundingResponse: PostFundingResponse = {
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

      const apiAccessTokenResponse: GetAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: BigInt(10).toString(),
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, apiAccessTokenResponse);
      await request(app).post("/client/quota").send({
        client: "client",
        quota: 1,
      });

      spy.mockImplementation(async () => undefined);

      const requestResponse = await request(app)
        .post("/request/entry-node")
        .send({ client: "client" });

      assert.equal(requestResponse.body.errors, "Could not find eligible node");
      spy.mockRestore();
    });
    it("should reduce client quota", async function () {
      const spyGetEligibleNode = jest.spyOn(registeredNode, "getEligibleNode");
      const amountLeft = BigInt(10).toString();
      const peerId = "entry";
      const requestId = 1;

      const apiTokenResponse: GetAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: BigInt(10).toString(),
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, apiTokenResponse);

      // add quota to newClient
      await request(app).post("/client/quota").send({
        client: "newClient",
        quota: BASE_QUOTA.toString(),
      });

      await request(app).post("/node/register").send(mockNode(peerId, true));

      const createdNode: {
        body: { node: RegisteredNodeDB | undefined };
      } = await request(app).get(`/node/${peerId}`);

      spyGetEligibleNode.mockImplementation(async () => {
        return createdNode.body.node;
      });

      const fundingResponse: PostFundingResponse = {
        amountLeft,
        id: requestId,
      };

      // mocks response from funding request
      nockFundingRequest(createdNode.body.node?.native_address!).reply(
        200,
        fundingResponse
      );

      // use quota twice expecting the second time for it to fail
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

      spyGetEligibleNode.mockRestore();
    });
    it("should be able to use trial mode client and reduce quota", async function () {
      const spyGetEligibleNode = jest.spyOn(registeredNode, "getEligibleNode");
      const amountLeft = BigInt(10).toString();
      const peerId = "entry";
      const requestId = 1;

      const apiTokenResponse: GetAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: BigInt(10).toString(),
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, apiTokenResponse);

      const responseRequestTrialClient = await request(app).get(
        "/request/trial"
      );
      const trialClientId: string = responseRequestTrialClient.body.client;

      await request(app).post("/client/quota").send({
        client: "trial",
        quota: BASE_QUOTA.toString(),
      });

      await request(app).post("/node/register").send(mockNode(peerId, true));

      const createdNode: {
        body: { node: RegisteredNodeDB | undefined };
      } = await request(app).get(`/node/${peerId}`);

      spyGetEligibleNode.mockImplementation(async () => {
        return createdNode.body.node;
      });

      const fundingResponse: PostFundingResponse = {
        amountLeft,
        id: requestId,
      };

      nockFundingRequest(createdNode.body.node?.native_address!).reply(
        200,
        fundingResponse
      );

      const trialClientQuotaBefore = await getSumOfQuotasPaidByClient(
        dbInstance,
        "trial"
      );

      const requestResponse = await request(app)
        .post("/request/entry-node")
        .send({ client: trialClientId });

      const trialClientQuotaAfter = await getSumOfQuotasPaidByClient(
        dbInstance,
        "trial"
      );

      const b2dClientQuotaUsed = await getSumOfQuotasUsedByClient(
        dbInstance,
        trialClientId
      );

      expect(b2dClientQuotaUsed).toEqual(BASE_QUOTA * BigInt(-1));
      expect(trialClientQuotaAfter).toBeLessThan(trialClientQuotaBefore);
      expect(requestResponse.body).toHaveProperty("id");

      spyGetEligibleNode.mockRestore();
    });

    describe("test cache requests", function () {
      it("should save request", function () {
        const mockRequest = { url: "/test" } as Request;
        // just return whatever is sent using .json
        const mockResponse = {
          json: jest.fn((args) => args),
        } as unknown as Response;
        setCache("/test", 100, "test");
        const res = getCache()(mockRequest, mockResponse, {} as any);
        assert.equal(res, "test");
      });
      it("should call next if nothing is cached", async () => {
        const mockRequest = { url: "/test" } as Request;
        // just return whatever is sent using .json
        const mockResponse = {
          json: jest.fn((args) => args),
        } as unknown as Response;
        const mockNext = jest.fn() as NextFunction;
        // result
        getCache()(mockRequest, mockResponse, mockNext);
        expect(mockNext).toHaveBeenCalled();
      });
      it("should cache when request is successful", async function () {
        await request(app).post("/node/register").send(mockNode("exit1", true));
        await request(app).post("/node/register").send(mockNode("exit2", true));

        // caching endpoint /node
        const allExitNodes = await request(app).get(`/node?hasExitNode=true`);
        const secondAllExitNodeResponse = await request(app).get(
          `/node?hasExitNode=true`
        );

        assert.deepEqual(
          JSON.stringify(memoryCache.get("/node?hasExitNode=true")),
          JSON.stringify(allExitNodes.body)
        );

        assert.deepEqual(
          JSON.stringify(memoryCache.get("/node?hasExitNode=true")),
          JSON.stringify(secondAllExitNodeResponse.body)
        );
      });
    });
  });
  describe("should register metric", function () {
    it("registers request duration", async function () {
      const requestDurationHistogram = new Prometheus.Histogram({
        name: "test_request_duration_seconds",
        help: "Test request duration in seconds",
        labelNames: ["method", "path", "status"],
        buckets: [0.1, 0.5, 1, 5, 10, 30],
      });
      const middleware = requestDurationMiddleware(requestDurationHistogram);
      await middleware(
        {} as Request,
        {
          on: jest.fn((event, callback) => {
            if (event === "finish") {
              callback();
            }
          }),
          statusCode: 200,
        } as unknown as Response,
        jest.fn()
      );
      expect(requestDurationHistogram).toHaveBeenCalled();
    });
  });
});
