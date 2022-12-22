import assert from "assert";
import { FundingPlatformApi } from ".";
import * as db from "../db";
import nock from "nock";
import {
  getAccessTokenResponse,
  getRequestStatusResponse,
  postFundingResponse,
} from "./dto";
import { QueryRegisteredNode } from "../registered-node/dto";

const FUNDING_PLATFORM_URL = "http://localhost:5000";
const FAKE_ACCESS_TOKEN = "EcLjvxdALOT0eq18d8Gzz3DEr3AMG27NtL+++YPSZNE=";

const nockGetApiAccessToken =
  nock(FUNDING_PLATFORM_URL).get("/api/access-token");
const nockFundingRequest = (peerId: string) =>
  nock(FUNDING_PLATFORM_URL).post(`/api/request/funds/${peerId}`);
const nockRequestStatus = (requestId: number) =>
  nock(FUNDING_PLATFORM_URL).get(`/api/request/status/${requestId}`);
const nockGetFunds = nock(FUNDING_PLATFORM_URL).get("/api/funds");

const createMockNode = (peerId?: string) =>
  ({
    chainId: 100,
    peerId: peerId ?? "peerId",
    hasExitNode: true,
    honestyScore: 0,
    registeredAt: new Date(Date.now()),
    status: "FRESH",
    totalAmountFunded: 0,
  } as QueryRegisteredNode);

describe("test funding platform api class", function () {
  let fundingPlatformApi: FundingPlatformApi;
  let dbInstance: db.DBInstance;

  beforeEach(function () {
    dbInstance = {
      data: {
        registeredNodes: [],
        quotas: [],
      },
    };
    fundingPlatformApi = new FundingPlatformApi(
      FUNDING_PLATFORM_URL,
      dbInstance
    );
  });

  it("should fetch access token and save it to instance", async function () {
    nockGetApiAccessToken.reply(200, {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: 10,
      expiredAt: new Date(Date.now()).toISOString(),
    } as getAccessTokenResponse);
    // @ts-ignore-next-line
    const res = await fundingPlatformApi.fetchAccessToken();
    // @ts-ignore-next-line
    assert.equal(res, FAKE_ACCESS_TOKEN);
  });

  describe("validate token", function () {
    it("should return true if token is valid", async function () {
      const now = new Date(Date.now());
      now.setMinutes(now.getMinutes() + 30);
      nockGetApiAccessToken.reply(200, {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: 10,
        expiredAt: now.toISOString(),
      } as getAccessTokenResponse);
      // @ts-ignore-next-line
      await fundingPlatformApi.fetchAccessToken();
      // @ts-ignore-next-line
      const isTokenValid = fundingPlatformApi.accessTokenIsValid();
      assert(isTokenValid);
    });
    it("should return false if token is expired", async function () {
      const now = new Date(Date.now());
      now.setMinutes(now.getMinutes() - 30);
      nockGetApiAccessToken.reply(200, {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: 10,
        expiredAt: now.toISOString(),
      } as getAccessTokenResponse);
      // @ts-ignore-next-line
      await fundingPlatformApi.fetchAccessToken();
      // @ts-ignore-next-line
      const isTokenValid = fundingPlatformApi.accessTokenIsValid();
      assert(!isTokenValid);
    });
    it("should return false if token does not exist", function () {
      // @ts-ignore-next-line
      const isTokenValid = fundingPlatformApi.accessTokenIsValid();
      assert(!isTokenValid);
    });
    it("should return false if has been exceeded max amount", async function () {
      const now = new Date(Date.now());
      now.setMinutes(now.getMinutes() + 30);
      nockGetApiAccessToken.reply(200, {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: 9,
        expiredAt: now.toISOString(),
      } as getAccessTokenResponse);
      // @ts-ignore-next-line
      await fundingPlatformApi.fetchAccessToken();
      // @ts-ignore-next-line
      const isTokenValid = fundingPlatformApi.accessTokenIsValid(10);
      assert(!isTokenValid);
    });
  });
  it("should save access token", function () {
    const now = new Date(Date.now());
    now.setMinutes(now.getMinutes() + 30);
    const amountLeft = 30;
    // @ts-ignore
    fundingPlatformApi.saveAccessToken({
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: amountLeft,
      expiredAt: now.toISOString(),
    });
    // @ts-ignore
    assert(fundingPlatformApi.accessToken, FAKE_ACCESS_TOKEN);
    // @ts-ignore
    assert(fundingPlatformApi.amountLeft, amountLeft);
    // @ts-ignore
    assert(fundingPlatformApi.expiredAt, now.toISOString());
  });
  it("should get access token", async function () {
    nockGetApiAccessToken.reply(200, {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: 10,
      expiredAt: new Date().toISOString(),
    } as getAccessTokenResponse);

    // @ts-ignore
    const accessToken = await fundingPlatformApi.getAccessToken();

    assert.equal(accessToken, FAKE_ACCESS_TOKEN);
  });
  it("should request funds", async function () {
    const node = createMockNode("peer1");
    const amountLeft = 10;
    const requestId = 123;

    nockGetApiAccessToken.reply(200, {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: 10,
      expiredAt: new Date().toISOString(),
    } as getAccessTokenResponse);

    nockFundingRequest("peer1").reply(200, {
      amountLeft,
      id: requestId,
    } as postFundingResponse);

    await db.saveRegisteredNode(dbInstance, node);
    const fundingResponse = await fundingPlatformApi.requestFunds(5, node);
    const dbNode = await db.getRegisteredNode(dbInstance, "peer1");

    assert.equal(dbNode?.status, "FUNDING");
    assert.equal(
      // @ts-ignore
      fundingPlatformApi.pendingRequests.get("peer1")?.requestId,
      fundingResponse
    );
  });
  it("should get request status", async function () {
    const requestId = 123;

    nockGetApiAccessToken.reply(200, {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: 10,
      expiredAt: new Date().toISOString(),
    } as getAccessTokenResponse);

    nockRequestStatus(requestId).reply(200, {
      accessTokenHash: "hash",
      amount: "10",
      chainId: 10,
      createdAt: new Date(),
      nodeAddress: "peer",
      requestId,
      status: "FRESH",
    } as getRequestStatusResponse);

    // @ts-ignore
    const requestStatus = await fundingPlatformApi.getRequestStatus(requestId);

    assert.equal(requestStatus.status, "FRESH");
  });
  it("should save pending request", function () {
    // @ts-ignore
    fundingPlatformApi.savePendingRequest("peer1", 123, 0);

    assert.equal(
      // @ts-ignore
      fundingPlatformApi.pendingRequests.get("peer1")?.requestId,
      123
    );
    assert.equal(
      // @ts-ignore
      fundingPlatformApi.pendingRequests.get("peer1")?.amountOfRetries,
      0
    );
  });
  describe("check pending requests", function () {
    it("should update db and delete request from pending request if it passed successfully", async function () {
      const node = createMockNode("peer1");
      const amountLeft = 10;
      const requestId = 123;

      nockGetApiAccessToken.twice().reply(200, {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft: 10,
        expiredAt: new Date().toISOString(),
      } as getAccessTokenResponse);

      nockFundingRequest(node.peerId).reply(200, {
        amountLeft,
        id: requestId,
      } as postFundingResponse);

      await db.saveRegisteredNode(dbInstance, node);

      const fundingResponse = await fundingPlatformApi.requestFunds(5, node);

      nockRequestStatus(fundingResponse).reply(200, {
        accessTokenHash: "hash",
        amount: "5",
        chainId: node.chainId,
        createdAt: new Date(),
        nodeAddress: node.peerId,
        requestId,
        status: "SUCCESS",
      } as getRequestStatusResponse);

      await fundingPlatformApi.checkForPendingRequests();
      const dbNode = await db.getRegisteredNode(dbInstance, node.peerId);

      assert.equal(
        // @ts-ignore
        fundingPlatformApi.pendingRequests.has(node.peerId),
        false
      );
      assert.equal(
        // @ts-ignore
        dbNode.status,
        "READY"
      );
      assert.equal(
        // @ts-ignore
        dbNode?.totalAmountFunded,
        "5"
      );
    });
    it("should not do anything if request is still pending", async function () {
      const node = createMockNode("peer1");
      const amountLeft = 10;
      const requestId = 123;

      nockGetApiAccessToken.twice().reply(200, {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft,
        expiredAt: new Date().toISOString(),
      } as getAccessTokenResponse);

      nockFundingRequest(node.peerId).reply(200, {
        amountLeft,
        id: requestId,
      } as postFundingResponse);

      await db.saveRegisteredNode(dbInstance, node);

      const fundingResponse = await fundingPlatformApi.requestFunds(5, node);

      nockRequestStatus(fundingResponse).reply(200, {
        accessTokenHash: "hash",
        amount: "5",
        chainId: node.chainId,
        createdAt: new Date(),
        nodeAddress: node.peerId,
        requestId,
        status: "PENDING",
      } as getRequestStatusResponse);

      await fundingPlatformApi.checkForPendingRequests();
      const dbNode = await db.getRegisteredNode(dbInstance, node.peerId);

      assert.equal(
        // @ts-ignore
        fundingPlatformApi.pendingRequests.has(node.peerId),
        true
      );
      assert.equal(
        // @ts-ignore
        dbNode.status,
        "FUNDING"
      );
      assert.equal(
        // @ts-ignore
        dbNode?.totalAmountFunded,
        "0"
      );
    });
    it("should retry request if request failed", async function () {
      const node = createMockNode("peer1");
      const amountLeft = 10;
      const requestId = 123;

      nockGetApiAccessToken.thrice().reply(200, {
        accessToken: FAKE_ACCESS_TOKEN,
        amountLeft,
        expiredAt: new Date().toISOString(),
      } as getAccessTokenResponse);

      nockFundingRequest(node.peerId)
        .twice()
        .reply(200, {
          amountLeft,
          id: requestId,
        } as postFundingResponse);

      await db.saveRegisteredNode(dbInstance, node);

      const fundingResponse = await fundingPlatformApi.requestFunds(5, node);

      nockRequestStatus(fundingResponse).reply(200, {
        accessTokenHash: "hash",
        amount: "5",
        chainId: node.chainId,
        createdAt: new Date(),
        nodeAddress: node.peerId,
        requestId,
        status: "FAILED",
      } as getRequestStatusResponse);

      await fundingPlatformApi.checkForPendingRequests();
      const dbNode = await db.getRegisteredNode(dbInstance, node.peerId);

      assert.equal(
        // @ts-ignore
        fundingPlatformApi.pendingRequests.has(node.peerId),
        true
      );
      assert.equal(
        // @ts-ignore
        fundingPlatformApi.pendingRequests.get(node.peerId)?.amountOfRetries,
        1
      );
      assert.notEqual(dbNode?.status, "READY");
      assert.equal(dbNode?.totalAmountFunded, "0");
    });
  });
  it("should get funding platform funds", async function () {
    nockGetApiAccessToken.once().reply(200, {
      accessToken: FAKE_ACCESS_TOKEN,
      amountLeft: 10,
      expiredAt: new Date().toISOString(),
    } as getAccessTokenResponse);

    nockGetFunds.reply(200, {
      80: 10,
      100: 4000,
    });

    const funds = await fundingPlatformApi.getAvailableFunds();

    assert.equal(funds[80], 10);
  });
});
