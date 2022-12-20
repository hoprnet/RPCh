import * as db from ".";
import assert from "assert";
import { DBInstance } from "../db";
import { CreateAccessToken } from "../access-token";
import { CreateRequest, UpdateRequest } from "../request";

const mockCreateAccessToken = () => ({
  Id: Math.floor(Math.random() * 1e6),
  CreatedAt: new Date(Date.now()).toISOString(),
  ExpiredAt: new Date(Date.now()).toISOString(),
  Token: "token",
});

const mockCreateRequest = (hash?: string) =>
  ({
    requestId: Math.floor(Math.random() * 1e6),
    accessTokenHash: hash ?? "hash",
    amount: "10",
    chainId: 80,
    nodeAddress: "address",
    createdAt: new Date(Date.now()).toISOString(),
  } as CreateRequest);

describe("test db adapter functions", function () {
  let dbInstance: DBInstance;
  beforeEach(function () {
    dbInstance = {
      data: { accessTokens: [], requests: [] },
    } as unknown as DBInstance;
  });
  it("should save access token", async function () {
    const createAccessToken: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken.Token
    );
    assert(dbAccessToken?.Token, createAccessToken.Token);
  });
  it("should get access token", async function () {
    const createAccessToken1: CreateAccessToken = mockCreateAccessToken();
    const createAccessToken2: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken1);
    await db.saveAccessToken(dbInstance, createAccessToken2);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken2.Token
    );
    assert(dbAccessToken?.Token, createAccessToken2.Token);
  });
  it("should delete access token", async function () {
    const createAccessToken: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    await db.deleteAccessToken(dbInstance, createAccessToken.Token);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken.Token
    );
    assert(dbAccessToken === undefined);
  });
  it("should save request", async function () {
    const request = mockCreateRequest();
    await db.saveRequest(dbInstance, request);
    const dbRequest = await db.getRequest(dbInstance, request.requestId);
    assert.equal(request.requestId, dbRequest?.requestId);
  });
  it("should get request by id", async function () {
    const request1 = mockCreateRequest();

    await db.saveRequest(dbInstance, request1);

    const request2 = mockCreateRequest();

    await db.saveRequest(dbInstance, request2);

    const dbRequest = await db.getRequest(dbInstance, request2.requestId);

    assert.equal(dbRequest?.requestId, request2.requestId);
  });
  it("should get requests", async function () {
    const request1 = mockCreateRequest();

    await db.saveRequest(dbInstance, request1);

    const request2 = mockCreateRequest();

    await db.saveRequest(dbInstance, request2);

    const dbRequestsByAccessToken = await db.getRequests(dbInstance);

    assert.equal(dbRequestsByAccessToken?.length, 2);
  });
  it("should get requests by access token", async function () {
    const request1 = mockCreateRequest();

    await db.saveRequest(dbInstance, request1);

    const request2 = mockCreateRequest("different hash");

    await db.saveRequest(dbInstance, request2);

    const dbRequestsByAccessToken = await db.getRequestsByAccessToken(
      dbInstance,
      request2.accessTokenHash
    );

    assert.equal(dbRequestsByAccessToken?.length, 1);
  });
  it("should delete request", async function () {
    const request = mockCreateRequest();

    await db.saveRequest(dbInstance, request);

    await db.deleteRequest(dbInstance, request.requestId);

    const dbRequest = await db.getRequest(dbInstance, request.requestId);

    assert.equal(dbRequest, undefined);
  });
  it("should update request", async function () {
    const request = mockCreateRequest();

    await db.saveRequest(dbInstance, request);

    const updateRequest = {
      ...request,
      amount: "20",
    } as UpdateRequest;

    await db.updateRequest(dbInstance, updateRequest);

    const dbUpdatedRequest = await db.getRequest(dbInstance, request.requestId);

    assert.equal(dbUpdatedRequest?.amount, 20);
  });
});
