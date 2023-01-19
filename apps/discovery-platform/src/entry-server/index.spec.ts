import { Express } from "express";
import { entryServer } from ".";
import { DBInstance } from "../db";
import nock from "nock";
import { MockPgInstanceSingleton } from "../db/index.spec";
import { FundingServiceApi } from "../funding-service-api";
import * as registeredNode from "../registered-node";
import {
  getAccessTokenResponse,
  postFundingResponse,
} from "../funding-service-api/dto";
import request from "supertest";
import {
  CreateRegisteredNode,
  QueryRegisteredNode,
} from "../registered-node/dto";
import assert from "assert";

const FUNDING_SERVICE_URL = "http://localhost:5000";
const ACCESS_TOKEN = "ACCESS";
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
  hoprdApiEndpoint: "localhost",
  hoprdApiPort: 5000,
  exitNodePubKey: "somePubKey",
  nativeAddress: "someAddress",
});

describe("test entry server", function () {
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
    app = entryServer({
      db: dbInstance,
      baseQuota: BASE_QUOTA,
      accessToken: ACCESS_TOKEN,
      fundingServiceApi,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should retrieve an entry node", async function () {
    const spy = jest.spyOn(registeredNode, "getEligibleNode");
    const amountLeft = 10;
    const peerId = "entry";
    const requestId = 1;

    nockGetApiAccessToken.reply(200, {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: 10,
      expiredAt: new Date().toISOString(),
    } as getAccessTokenResponse);

    await request(app).post("/api/v1/client/funds").send({
      client: "client",
      quota: 1,
    });

    await request(app)
      .post("/api/v1/node/register")
      .send(mockNode(peerId, true));

    const createdNode = (await request(app).get(`/api/v1/node/${peerId}`)) as {
      body: { node: QueryRegisteredNode | undefined };
    };

    spy.mockImplementation(async () => {
      return createdNode.body.node;
    });

    nockFundingRequest(createdNode.body.node?.native_address!).reply(200, {
      amountLeft,
      id: requestId,
    } as postFundingResponse);

    const requestResponse = await request(app)
      .post("/api/v1/request/entry-node")
      .send({ client: "client" });

    if (!requestResponse.body || !createdNode.body.node)
      throw new Error("Could not create mock nodes");

    assert.equal(requestResponse.body.id, createdNode.body.node.id);
    spy.mockRestore();
  });
});
