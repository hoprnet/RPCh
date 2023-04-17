import assert from "assert";
import express, { type Express } from "express";
import nock from "nock";
import request from "supertest";
import { v1Router } from ".";
import { getClient } from "../../../client";
import { DBInstance } from "../../../db";
import { FundingServiceApi } from "../../../funding-service-api";
import {
  getSumOfQuotasUsedByClient,
  getSumOfQuotasPaidByClient,
} from "../../../quota";
import * as registeredNode from "../../../registered-node";
import {
  RegisteredNode,
  RegisteredNodeDB,
  GetAccessTokenResponse,
  PostFundingResponse,
} from "../../../types";
import memoryCache from "memory-cache";
import * as Prometheus from "prom-client";
import path from "path";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import { MockPgInstanceSingleton } from "@rpch/common/build/internal/db";
import * as PgMem from "pg-mem";

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
    const migrationsDirectory = path.join(__dirname, "../../../../migrations");
    dbInstance = await MockPgInstanceSingleton.getDbInstance(
      PgMem,
      migrationsDirectory
    );
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(async function () {
    MockPgInstanceSingleton.getInitialState().restore();
    const fundingServiceApi = new FundingServiceApi(
      FUNDING_SERVICE_URL,
      dbInstance
    );
    const register = new Prometheus.Registry();
    const metricManager = new MetricManager(Prometheus, register, "test");
    app = express().use(
      "",
      v1Router({
        db: dbInstance,
        baseQuota: BASE_QUOTA,
        fundingServiceApi,
        metricManager: metricManager,
      })
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
    memoryCache.clear();
  });

  it("should register a node", async function () {
    const node = mockNode();
    const responseRequestTrialClient = await request(app).get("/request/trial");
    const trialClientId: string = responseRequestTrialClient.body.client;
    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(node);
    const createdNode = await request(app)
      .get(`/node/${node.peerId}`)
      .set("X-Rpch-Client", trialClientId);
    assert.equal(createdNode.body.node.id, node.peerId);
  });

  it("should get a node", async function () {
    const node = mockNode();
    const responseRequestTrialClient = await request(app).get("/request/trial");
    const trialClientId: string = responseRequestTrialClient.body.client;
    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(node);
    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode("fake"));
    const createdNode = await request(app)
      .get(`/node/${node.peerId}`)
      .set("X-Rpch-Client", trialClientId);
    assert.equal(createdNode.body.node.id, node.peerId);
  });

  it("should get all nodes that are exit node", async function () {
    const responseRequestTrialClient = await request(app).get("/request/trial");
    const trialClientId: string = responseRequestTrialClient.body.client;

    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode("notExit1", false));
    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode("notExit2", false));
    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode("exit3", true));
    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode("exit4", true));

    const allExitNodes = await request(app)
      .get(`/node?hasExitNode=true`)
      .set("X-Rpch-Client", trialClientId);
    assert.equal(allExitNodes.body.length, 2);
  });

  it("should get all nodes that are not exit nodes and are not in the exclude list", async function () {
    const responseRequestTrialClient = await request(app).get("/request/trial");
    const trialClientId: string = responseRequestTrialClient.body.client;

    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode("notExit1", false));
    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode("notExit2", false));
    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode("notExit3", false));
    await request(app)
      .post("/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode("exit4", true));

    const allExitNodes = await request(app)
      .get(`/node?hasExitNode=${false}&excludeList=notExit2`)
      .set("X-Rpch-Client", trialClientId);
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
  it("should create trial client", async function () {
    const responseRequestTrialClient = await request(app).get("/request/trial");
    const trialClientId: string = responseRequestTrialClient.body.client;

    const response = await request(app)
      .get("/request/trial?label=devcon,some-dash")
      .set("X-Rpch-Client", trialClientId);
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
      const responseRequestTrialClient = await request(app).get(
        "/request/trial"
      );
      const trialClientId: string = responseRequestTrialClient.body.client;

      const replyBody: GetAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: BigInt(10).toString(),
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, replyBody);
      await request(app)
        .post("/client/quota")
        .send({
          client: trialClientId,
          quota: BigInt("1").toString(),
        });

      await request(app)
        .post("/node/register")
        .set("X-Rpch-Client", trialClientId)
        .send(mockNode(peerId, true));

      const createdNode: {
        body: { node: RegisteredNodeDB | undefined };
      } = await request(app)
        .get(`/node/${peerId}`)
        .set("X-Rpch-Client", trialClientId);

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
        .set("X-Rpch-Client", trialClientId);

      assert.equal(requestResponse.body.id, createdNode.body.node?.id);
      spy.mockRestore();
    });
    it("should return an entry node that is not in the exclude list", async function () {
      const amountLeft = BigInt(10).toString();
      const peerId = "entry";
      const requestId = 1;
      const responseRequestTrialClient = await request(app).get(
        "/request/trial"
      );
      const trialClientId: string = responseRequestTrialClient.body.client;

      const replyBody: GetAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: BigInt(10).toString(),
        expiredAt: new Date().toISOString(),
      };

      nockGetApiAccessToken.reply(200, replyBody);
      await request(app).post("/client/quota").send({
        client: trialClientId,
        quota: 1,
      });

      await request(app)
        .post("/node/register")
        .set("X-Rpch-Client", trialClientId)
        .send(mockNode(peerId, true));

      await request(app)
        .post("/node/register")
        .set("X-Rpch-Client", trialClientId)
        .send(mockNode(peerId + "2", true));

      const firstCreatedNode: {
        body: { node: RegisteredNodeDB | undefined };
      } = await request(app)
        .get(`/node/${peerId}`)
        .set("X-Rpch-Client", trialClientId);
      const secondCreatedNode: {
        body: { node: RegisteredNodeDB | undefined };
      } = await request(app)
        .get(`/node/${peerId + "2"}`)
        .set("X-Rpch-Client", trialClientId);

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
        .set("X-Rpch-Client", trialClientId)
        .send({ excludeList: ["entry"] });

      assert.equal(requestResponse.body.id, secondCreatedNode.body.node?.id);
    });
    it("should fail if no entry node is selected", async function () {
      const spy = jest.spyOn(registeredNode, "getEligibleNode");

      const apiAccessTokenResponse: GetAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: BigInt(10).toString(),
        expiredAt: new Date().toISOString(),
      };

      const responseRequestTrialClient = await request(app).get(
        "/request/trial"
      );
      const trialClientId: string = responseRequestTrialClient.body.client;
      nockGetApiAccessToken.reply(200, apiAccessTokenResponse);

      await request(app).post("/client/quota").send({
        client: trialClientId,
        quota: 1,
      });

      spy.mockImplementation(async () => undefined);

      const requestResponse = await request(app)
        .post("/request/entry-node")
        .set("X-Rpch-Client", trialClientId);

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

      const responseRequestTrialClient = await request(app).get(
        "/request/trial"
      );
      const trialClientId: string = responseRequestTrialClient.body.client;

      nockGetApiAccessToken.reply(200, apiTokenResponse);

      // add quota to newClient
      await request(app).post("/client/quota").send({
        client: "newClient",
        quota: BASE_QUOTA.toString(),
      });

      await request(app)
        .post("/node/register")
        .set("X-Rpch-Client", trialClientId)
        .send(mockNode(peerId, true));

      const createdNode: {
        body: { node: RegisteredNodeDB | undefined };
      } = await request(app)
        .get(`/node/${peerId}`)
        .set("X-Rpch-Client", trialClientId);

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
        .set("X-Rpch-Client", trialClientId);

      const requestResponse = await request(app)
        .post("/request/entry-node")
        .set("X-Rpch-Client", trialClientId);

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

      await request(app)
        .post("/node/register")
        .set("X-Rpch-Client", trialClientId)
        .send(mockNode(peerId, true));

      const createdNode: {
        body: { node: RegisteredNodeDB | undefined };
      } = await request(app)
        .get(`/node/${peerId}`)
        .set("X-Rpch-Client", trialClientId);

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
        .set("X-Rpch-Client", trialClientId);

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
  });
});
