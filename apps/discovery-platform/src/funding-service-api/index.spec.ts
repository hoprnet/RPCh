import assert from "assert";
import { FundingServiceApi } from ".";
import * as db from "../db";
import nock from "nock";
import {
  getAccessTokenResponse,
  getRequestStatusResponse,
  postFundingResponse,
} from "./dto";
import { QueryRegisteredNode } from "../registered-node/dto";
import { MockPgInstanceSingleton } from "../db/index.spec";

const FUNDING_SERVICE_URL = "http://localhost:5000";
const FAKE_ACCESS_TOKEN = "EcLjvxdALOT0eq18d8Gzz3DEr3AMG27NtL+++YPSZNE=";

const nockGetApiAccessToken =
  nock(FUNDING_SERVICE_URL).get("/api/access-token");
const nockFundingRequest = (id: string) =>
  nock(FUNDING_SERVICE_URL).post(`/api/request/funds/${id}`);
const nockRequestStatus = (requestId: number) =>
  nock(FUNDING_SERVICE_URL).get(`/api/request/status/${requestId}`);
const nockGetFunds = nock(FUNDING_SERVICE_URL).get("/api/funds");

const now = new Date(Date.now());
now.setMinutes(now.getMinutes() + 30);

const successfulGetApiAccessTokenBody: getAccessTokenResponse = {
  accessToken: FAKE_ACCESS_TOKEN,
  amountLeft: BigInt("10").toString(),
  expiredAt: now.toISOString(),
};

const createMockNode = (peerId?: string): QueryRegisteredNode => ({
  chain_id: 100,
  id: peerId ?? "peerId",
  has_exit_node: true,
  honesty_score: 0,
  status: "FRESH",
  total_amount_funded: BigInt(0),
  hoprd_api_endpoint: "localhost:5000",
  hoprd_api_token: "sometoken",
  native_address: "someaddress",
  exit_node_pub_key: "somepubkey",
  created_at: Date.now().toString(),
  updated_at: Date.now().toString(),
});

describe("test funding service api class", function () {
  let fundingServiceApi: FundingServiceApi;
  let dbInstance: db.DBInstance;

  beforeAll(async function () {
    dbInstance = MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(function () {
    MockPgInstanceSingleton.getInitialState().restore();
    fundingServiceApi = new FundingServiceApi(FUNDING_SERVICE_URL, dbInstance);
  });

  it("should fetch access token and save it to instance", async function () {
    nockGetApiAccessToken.reply(200, successfulGetApiAccessTokenBody);
    // @ts-ignore-next-line
    const res = await fundingServiceApi.fetchAccessToken();
    // @ts-ignore-next-line
    assert.equal(res, FAKE_ACCESS_TOKEN);
  });

  describe("validate token", function () {
    it("should return true if token is valid", async function () {
      nockGetApiAccessToken.reply(200, successfulGetApiAccessTokenBody);
      // @ts-ignore-next-line
      await fundingServiceApi.fetchAccessToken();
      // @ts-ignore-next-line
      const isTokenValid = fundingServiceApi.accessTokenIsValid();
      assert(isTokenValid);
    });
    it("should return false if token is expired", async function () {
      const now = new Date(Date.now());
      now.setMinutes(now.getMinutes() - 30);
      const expiredAccessTokenResponse: getAccessTokenResponse = {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: BigInt("10").toString(),
        expiredAt: now.toISOString(),
      };
      nockGetApiAccessToken.reply(200, expiredAccessTokenResponse);
      // @ts-ignore-next-line
      await fundingServiceApi.fetchAccessToken();
      // @ts-ignore-next-line
      const isTokenValid = fundingServiceApi.accessTokenIsValid();
      assert(!isTokenValid);
    });
    it("should return false if token does not exist", function () {
      // @ts-ignore-next-line
      const isTokenValid = fundingServiceApi.accessTokenIsValid();
      assert(!isTokenValid);
    });
    it("should return false if has been exceeded max amount", async function () {
      const exceededAccessTokenResponse: getAccessTokenResponse = {
        ...successfulGetApiAccessTokenBody,
        amountLeft: BigInt("0").toString(),
      };
      nockGetApiAccessToken.reply(200, exceededAccessTokenResponse);
      // @ts-ignore-next-line
      await fundingServiceApi.fetchAccessToken();
      // @ts-ignore-next-line
      const isTokenValid = fundingServiceApi.accessTokenIsValid(10);
      assert(!isTokenValid);
    });
  });
  it("should save access token", function () {
    const now = new Date(Date.now());
    now.setMinutes(now.getMinutes() + 30);
    const amountLeft = BigInt(30).toString();
    // @ts-ignore
    fundingServiceApi.saveAccessToken({
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: amountLeft.toString(),
      expiredAt: now.toISOString(),
    });
    // @ts-ignore
    assert(fundingServiceApi.accessToken, FAKE_ACCESS_TOKEN);
    // @ts-ignore
    assert(fundingServiceApi.amountLeft, amountLeft);
    // @ts-ignore
    assert(fundingServiceApi.expiredAt, now.toISOString());
  });
  it("should get access token", async function () {
    const getAccessTokenResponse: getAccessTokenResponse = {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: BigInt("10").toString(),
      expiredAt: new Date(Date.now()).toISOString(),
    };
    nockGetApiAccessToken.reply(200, getAccessTokenResponse);

    // @ts-ignore
    const accessToken = await fundingServiceApi.getAccessToken();

    assert.equal(accessToken, FAKE_ACCESS_TOKEN);
  });
  it("should request funds", async function () {
    const node = createMockNode("peer1");
    const amountLeft = BigInt(10).toString();
    const requestId = 123;

    const getAccessTokenResponse: getAccessTokenResponse = {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: BigInt("10").toString(),
      expiredAt: new Date(Date.now()).toISOString(),
    };
    nockGetApiAccessToken.reply(200, getAccessTokenResponse);

    const postFundingResponseBody: postFundingResponse = {
      amountLeft,
      id: requestId,
    };

    nockFundingRequest(node.native_address).reply(200, postFundingResponseBody);

    await db.saveRegisteredNode(dbInstance, node);
    const fundingResponse = await fundingServiceApi.requestFunds({
      amount: BigInt(5),
      node,
    });
    const dbNode = await db.getRegisteredNode(dbInstance, "peer1");

    assert.equal(dbNode?.status, "FUNDING");
    assert.equal(
      // @ts-ignore
      fundingServiceApi.pendingRequests.has(fundingResponse),
      true
    );
  });
  it("should not change state if requesting funds failed", async function () {
    const node = createMockNode("peer1");
    const amountLeft = BigInt(10).toString();
    const requestId = 123;

    const getAccessTokenResponse: getAccessTokenResponse = {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: BigInt("10").toString(),
      expiredAt: new Date(Date.now()).toISOString(),
    };
    nockGetApiAccessToken.reply(200, getAccessTokenResponse);

    const postFundingResponseBody: Object = {
      body: "any error",
    };

    nockFundingRequest(node.native_address).reply(400, postFundingResponseBody);

    await db.saveRegisteredNode(dbInstance, node);
    try {
      const fundingResponse = await fundingServiceApi.requestFunds({
        amount: BigInt(5),
        node,
      });
    } catch (e) {
      let message = "Unknown Error";
      if (e instanceof Error) message = e.message;
      const dbNode = await db.getRegisteredNode(dbInstance, "peer1");

      assert.notEqual(dbNode?.status, "FUNDING");
      expect(message).toContain("funding request failed");
    }
  });
  it("should get request status", async function () {
    const requestId = 123;

    nockGetApiAccessToken.reply(200, successfulGetApiAccessTokenBody);

    const freshGetRequestStatusBody: getRequestStatusResponse = {
      accessTokenHash: "hash",
      amount: BigInt("10").toString(),
      chainId: 10,
      createdAt: new Date(),
      nodeAddress: "peer",
      requestId,
      status: "FRESH",
    };

    nockRequestStatus(requestId).reply(200, freshGetRequestStatusBody);

    // @ts-ignore
    const requestStatus = await fundingServiceApi.getRequestStatus(requestId);

    assert.equal(requestStatus.status, "FRESH");
  });
  it("should save pending request", function () {
    const requestId = 1;
    // @ts-ignore
    fundingServiceApi.savePendingRequest({ peerId: "peer1", requestId });

    assert.equal(
      // @ts-ignore
      fundingServiceApi.pendingRequests.get(requestId)?.peerId,
      "peer1"
    );
    assert.equal(
      // @ts-ignore
      fundingServiceApi.pendingRequests.get(requestId)?.amountOfRetries,
      0
    );
  });
  describe("check pending requests", function () {
    it("should update db and delete request from pending request if it passed successfully", async function () {
      const node = createMockNode("peer1");
      const amountLeft = BigInt(10).toString();
      const requestId = 123;

      nockGetApiAccessToken.twice().reply(200, successfulGetApiAccessTokenBody);

      const successfulPostFundingBody: postFundingResponse = {
        amountLeft,
        id: requestId,
      };

      nockFundingRequest(node.native_address).reply(
        200,
        successfulPostFundingBody
      );

      await db.saveRegisteredNode(dbInstance, node);

      const fundingResponse = await fundingServiceApi.requestFunds({
        amount: BigInt(5),
        node,
      });

      const successfulGetRequestStatusBody: getRequestStatusResponse = {
        accessTokenHash: "hash",
        amount: BigInt("5").toString(),
        chainId: node.chain_id,
        createdAt: new Date(),
        nodeAddress: node.id,
        requestId,
        status: "SUCCESS",
      };

      nockRequestStatus(fundingResponse).reply(
        200,
        successfulGetRequestStatusBody
      );

      await fundingServiceApi.checkForPendingRequests();
      const dbNode = await db.getRegisteredNode(dbInstance, node.id);

      assert.equal(
        // @ts-ignore
        fundingServiceApi.pendingRequests.has(node.peerId),
        false
      );
      assert.equal(
        // @ts-ignore
        dbNode.status,
        "READY"
      );
      assert.equal(
        // @ts-ignore
        dbNode?.total_amount_funded,
        "5"
      );
    });
    it("should not do anything if request is still pending", async function () {
      const node = createMockNode("peer1");
      const amountLeft = BigInt(10).toString();
      const requestId = 123;

      nockGetApiAccessToken.twice().reply(200, successfulGetApiAccessTokenBody);

      const successfulPostFundingBody: postFundingResponse = {
        amountLeft,
        id: requestId,
      };

      nockFundingRequest(node.native_address).reply(
        200,
        successfulPostFundingBody
      );

      await db.saveRegisteredNode(dbInstance, node);

      const fundingResponse = await fundingServiceApi.requestFunds({
        amount: BigInt(5),
        node,
      });

      const successfulGetRequestStatusBody: getRequestStatusResponse = {
        accessTokenHash: "hash",
        amount: BigInt("5").toString(),
        chainId: node.chain_id,
        createdAt: new Date(),
        nodeAddress: node.id,
        requestId,
        status: "PENDING",
      };

      nockRequestStatus(fundingResponse).reply(
        200,
        successfulGetRequestStatusBody
      );

      await fundingServiceApi.checkForPendingRequests();
      const dbNode = await db.getRegisteredNode(dbInstance, node.id);

      assert.equal(
        // @ts-ignore
        fundingServiceApi.pendingRequests.has(fundingResponse),
        true
      );
      assert.equal(
        // @ts-ignore
        dbNode.status,
        "FUNDING"
      );
      assert.equal(
        // @ts-ignore
        dbNode?.total_amount_funded,
        "0"
      );
    });
    it("should retry request if it failed", async function () {
      // @ts-ignore
      fundingServiceApi.maxAmountOfRetries = 1;
      const node = createMockNode("peer1");
      const amountLeft = BigInt(10).toString();
      const requestId = 123;

      nockGetApiAccessToken
        .thrice()
        .reply(200, successfulGetApiAccessTokenBody);

      const successfulPostFundingBody: postFundingResponse = {
        amountLeft,
        id: requestId,
      };

      nockFundingRequest(node.native_address)
        .twice()
        .reply(200, successfulPostFundingBody);

      await db.saveRegisteredNode(dbInstance, node);

      const fundingResponse = await fundingServiceApi.requestFunds({
        amount: BigInt(5),
        node,
      });

      const failedGetRequestStatusBody: getRequestStatusResponse = {
        accessTokenHash: "hash",
        amount: BigInt("5").toString(),
        chainId: node.chain_id,
        createdAt: new Date(),
        nodeAddress: node.id,
        requestId,
        status: "FAILED",
      };

      nockRequestStatus(fundingResponse).reply(200, failedGetRequestStatusBody);

      await fundingServiceApi.checkForPendingRequests();
      const dbNode = await db.getRegisteredNode(dbInstance, node.id);

      assert.equal(
        // @ts-ignore
        fundingServiceApi.pendingRequests.has(fundingResponse),
        true
      );
      assert.notEqual(dbNode?.status, "READY");
      assert.equal(dbNode?.total_amount_funded, "0");
    });
    it("should go to status 'READY' after max retries", async function () {
      const testMaxAmountOfRetries = 1;
      // @ts-ignore
      fundingServiceApi.maxAmountOfRetries = testMaxAmountOfRetries;

      const node = createMockNode("peer1");
      const amountLeft = BigInt(10).toString();
      const requestId = 123;

      const successfulPostFundingBody: postFundingResponse = {
        amountLeft,
        id: requestId,
      };

      nockGetApiAccessToken
        .times(testMaxAmountOfRetries + 1)
        .reply(200, successfulGetApiAccessTokenBody);

      nockFundingRequest(node.native_address)
        .times(testMaxAmountOfRetries + 1)
        .reply(200, successfulPostFundingBody);

      await db.saveRegisteredNode(dbInstance, node);

      const fundingResponse = await fundingServiceApi.requestFunds({
        amount: BigInt(5),
        node,
      });

      const failedGetRequestStatusBody: getRequestStatusResponse = {
        accessTokenHash: "hash",
        amount: BigInt("5").toString(),
        chainId: node.chain_id,
        createdAt: new Date(),
        nodeAddress: node.id,
        requestId,
        status: "FAILED",
      };

      nockRequestStatus(fundingResponse)
        .times(testMaxAmountOfRetries + 1)
        .reply(200, failedGetRequestStatusBody);

      // check for pending requests 1 more than the max amount so it can fail completely
      for (const _ of Array.from({ length: testMaxAmountOfRetries + 1 })) {
        await fundingServiceApi.checkForPendingRequests();
      }

      const dbNode = await db.getRegisteredNode(dbInstance, node.id);

      assert.equal(
        // @ts-ignore
        fundingServiceApi.pendingRequests.has(fundingResponse),
        false
      );
      assert.equal(dbNode?.status, "READY");
      assert.equal(dbNode?.total_amount_funded, "0");
    });
  });
  it("should get funding service funds", async function () {
    nockGetApiAccessToken.once().reply(200, successfulGetApiAccessTokenBody);

    nockGetFunds.reply(200, {
      80: 10,
      100: 4000,
    });

    const funds = await fundingServiceApi.getAvailableFunds();

    assert.equal(funds[80], 10);
  });
});
