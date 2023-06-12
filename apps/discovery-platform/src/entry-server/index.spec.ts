import { Express } from "express";
import { entryServer } from ".";
import { DBInstance } from "../db";
import nock from "nock";
import { FundingServiceApi } from "../funding-service-api";
import * as registeredNode from "../registered-node";
import request from "supertest";
import {
  RegisteredNode,
  RegisteredNodeDB,
  GetAccessTokenResponse,
  PostFundingResponse,
} from "../types";
import assert from "assert";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as Prometheus from "prom-client";
import { MockPgInstanceSingleton } from "@rpch/common/build/internal/db";
import path from "path";
import * as PgMem from "pg-mem";

const FUNDING_SERVICE_URL = "http://localhost:5000";
const BASE_QUOTA = BigInt(1);
const FAKE_ACCESS_TOKEN = "EcLjvxdALOT0eq18d8Gzz3DEr3AMG27NtL+++YPSZNE=";
const SECRET = "SECRET";

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

const UNSTABLE_NODE_PEERID = "unstable_peerid";
const getUnstableNodesMock = () => [UNSTABLE_NODE_PEERID];

describe("test entry server", function () {
  let dbInstance: DBInstance;
  let app: Express;

  beforeAll(async function () {
    const migrationsDirectory = path.join(__dirname, "../../migrations");
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
    app = entryServer({
      db: dbInstance,
      baseQuota: BASE_QUOTA,
      fundingServiceApi,
      metricManager: metricManager,
      secret: SECRET,
      getUnstableNodes: getUnstableNodesMock,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should retrieve an entry node", async function () {
    const spy = jest.spyOn(registeredNode, "getEligibleNode");
    const amountLeft = BigInt(10).toString();
    const peerId = "entry";
    const requestId = 1;
    const responseRequestTrialClient = await request(app).get(
      "/api/v1/request/trial"
    );
    const trialClientId: string = responseRequestTrialClient.body.client;

    const getAccessTokenBody: GetAccessTokenResponse = {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: BigInt(10).toString(),
      expiredAt: new Date().toISOString(),
    };

    nockGetApiAccessToken.reply(200, getAccessTokenBody);
    await request(app)
      .post("/api/v1/client/quota")
      .send({
        client: trialClientId,
        quota: BigInt(1).toString(),
      })
      .set("x-secret-key", SECRET);

    await request(app)
      .post("/api/v1/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode(peerId, true));

    const createdNode: {
      body: { node: RegisteredNodeDB | undefined };
    } = await request(app)
      .get(`/api/v1/node/${peerId}`)
      .set("X-Rpch-Client", trialClientId);

    spy.mockImplementation(async () => {
      return createdNode.body.node;
    });

    const fundingResponseBody: PostFundingResponse = {
      amountLeft,
      id: requestId,
    };

    nockFundingRequest(createdNode.body.node?.native_address!).reply(
      200,
      fundingResponseBody
    );

    const requestResponse = await request(app)
      .post("/api/v1/request/entry-node")
      .set("X-Rpch-Client", trialClientId);

    if (!requestResponse.body || !createdNode.body.node)
      throw new Error("Could not create mock nodes");

    assert.equal(requestResponse.body.id, createdNode.body.node.id);
    spy.mockRestore();
  });

  it("should not retrieve unstable entry node", async function () {
    const spy = jest.spyOn(registeredNode, "getEligibleNode");
    const amountLeft = BigInt(10).toString();
    const requestId = 1;
    const responseRequestTrialClient = await request(app).get(
      "/api/v1/request/trial"
    );
    const trialClientId: string = responseRequestTrialClient.body.client;

    const getAccessTokenBody: GetAccessTokenResponse = {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: BigInt(10).toString(),
      expiredAt: new Date().toISOString(),
    };

    nockGetApiAccessToken.reply(200, getAccessTokenBody);
    await request(app)
      .post("/api/v1/client/quota")
      .send({
        client: trialClientId,
        quota: BigInt(1).toString(),
      })
      .set("x-secret-key", SECRET);

    await request(app)
      .post("/api/v1/node/register")
      .set("X-Rpch-Client", trialClientId)
      .send(mockNode(UNSTABLE_NODE_PEERID, true));

    const createdNode: {
      body: { node: RegisteredNodeDB | undefined };
    } = await request(app)
      .get(`/api/v1/node/${UNSTABLE_NODE_PEERID}`)
      .set("X-Rpch-Client", trialClientId);

    spy.mockImplementation(async () => {
      return createdNode.body.node;
    });

    const fundingResponseBody: PostFundingResponse = {
      amountLeft,
      id: requestId,
    };

    nockFundingRequest(createdNode.body.node?.native_address!).reply(
      200,
      fundingResponseBody
    );

    const requestResponse = await request(app)
      .post("/api/v1/request/entry-node")
      .set("X-Rpch-Client", trialClientId);

    assert.equal(requestResponse.statusCode, 404);
    spy.mockRestore();
  });
});
