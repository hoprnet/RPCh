import { Express } from "express";
import { entryServer } from ".";
import { DBInstance } from "../db";
import * as registeredNode from "../registered-node";
import request from "supertest";
import { RegisteredNode, RegisteredNodeDB } from "../types";
import assert from "assert";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as Prometheus from "prom-client";
import { MockPgInstanceSingleton } from "@rpch/common/build/internal/db";
import path from "path";
import * as PgMem from "pg-mem";

const BASE_QUOTA = BigInt(1);
const SECRET = "SECRET";

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
const getAvailabilityMonitorResultsMock = () =>
  new Map<string, any>([[UNSTABLE_NODE_PEERID, {}]]);

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
    const register = new Prometheus.Registry();
    const metricManager = new MetricManager(Prometheus, register, "test");
    app = entryServer({
      db: dbInstance,
      baseQuota: BASE_QUOTA,
      metricManager: metricManager,
      secret: SECRET,
      getAvailabilityMonitorResults: getAvailabilityMonitorResultsMock,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should retrieve an entry node", async function () {
    const spy = jest.spyOn(registeredNode, "getEligibleNode");
    const peerId = "entry";
    const responseRequestTrialClient = await request(app).get(
      "/api/v1/request/trial"
    );
    const trialClientId: string = responseRequestTrialClient.body.client;

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
    const responseRequestTrialClient = await request(app).get(
      "/api/v1/request/trial"
    );
    const trialClientId: string = responseRequestTrialClient.body.client;

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

    const requestResponse = await request(app)
      .post("/api/v1/request/entry-node")
      .set("X-Rpch-Client", trialClientId);

    assert.equal(requestResponse.statusCode, 404);
    spy.mockRestore();
  });
});
