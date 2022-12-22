import assert from "assert";
import { IBackup, IMemoryDb } from "pg-mem";
import * as db from ".";
import { CreateAccessToken, generateAccessToken } from "../access-token";
import { DBInstance } from "../db";
import { CreateRequest, UpdateRequest } from "../request";
import fs from "fs";
import { newDb } from "pg-mem";

export async function mockPgInstance(): Promise<IMemoryDb> {
  const pgInstance = await newDb();
  pgInstance.public.none(fs.readFileSync("dump.sql", "utf8"));
  return pgInstance;
}

const mockCreateAccessToken = () => ({
  id: Math.floor(Math.random() * 1e6),
  createdAt: new Date(Date.now()).toISOString(),
  expiredAt: new Date(Date.now()).toISOString(),
  token: generateAccessToken({
    amount: 10,
    expiredAt: new Date(),
    secretKey: "secret",
  }),
});

const mockCreateRequest = (hash?: string) =>
  ({
    accessTokenHash: hash ?? "hash",
    amount: "10",
    chainId: 80,
    nodeAddress: "address",
    createdAt: new Date(Date.now()).toISOString(),
    status: "FRESH",
  } as CreateRequest);

describe("test db adapter functions", function () {
  let dbInstance: DBInstance;
  let pgInstance: IMemoryDb;
  let initialDbState: IBackup;

  beforeAll(async function () {
    pgInstance = await mockPgInstance();
    initialDbState = pgInstance.backup();
    dbInstance = pgInstance.adapters.createPgPromise();
  });

  beforeEach(async function () {
    initialDbState.restore();
  });

  it("should save access token", async function () {
    const createAccessToken: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken.token
    );
    assert(dbAccessToken?.token, createAccessToken.token);
  });
  it("should get access token", async function () {
    const createAccessToken1: CreateAccessToken = mockCreateAccessToken();
    const createAccessToken2: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken1);
    await db.saveAccessToken(dbInstance, createAccessToken2);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken2.token
    );
    assert(dbAccessToken?.token, createAccessToken2.token);
  });
  it("should delete access token", async function () {
    const createAccessToken: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    await db.deleteAccessToken(dbInstance, createAccessToken.token);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken.token
    );
    assert(dbAccessToken === null);
  });
  it("should save request", async function () {
    const createAccessToken: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request = mockCreateRequest(createAccessToken.token);
    const queryRequest = await db.saveRequest(dbInstance, request);
    const dbRequest = await db.getRequest(dbInstance, queryRequest.id);
    assert.equal(request.accessTokenHash, dbRequest?.access_token_hash);
  });
  it("should get request by id", async function () {
    const createAccessToken: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request1 = mockCreateRequest(createAccessToken.token);
    await db.saveRequest(dbInstance, request1);

    const createAccessToken2: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken2);
    const request2 = mockCreateRequest(createAccessToken2.token);

    const queryRequest2 = await db.saveRequest(dbInstance, request2);

    const dbRequest = await db.getRequest(dbInstance, queryRequest2.id);

    assert.equal(dbRequest?.access_token_hash, request2.accessTokenHash);
  });
  it("should get requests", async function () {
    const createAccessToken: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request1 = mockCreateRequest(createAccessToken.token);
    await db.saveRequest(dbInstance, request1);

    const createAccessToken2: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken2);
    const request2 = mockCreateRequest(createAccessToken2.token);
    await db.saveRequest(dbInstance, request2);

    const dbRequestsByAccessToken = await db.getRequests(dbInstance);

    assert.equal(dbRequestsByAccessToken?.length, 2);
  });
  it("should get requests by access token", async function () {
    const createAccessToken: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request1 = mockCreateRequest(createAccessToken.token);
    await db.saveRequest(dbInstance, request1);

    const createAccessToken2: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken2);
    const request2 = mockCreateRequest(createAccessToken2.token);
    await db.saveRequest(dbInstance, request2);

    const dbRequestsByAccessToken = await db.getRequestsByAccessToken(
      dbInstance,
      request2.accessTokenHash
    );

    assert.equal(dbRequestsByAccessToken?.length, 1);
  });
  it("should delete request", async function () {
    const createAccessToken: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request = mockCreateRequest(createAccessToken.token);
    const queryRequest = await db.saveRequest(dbInstance, request);
    await db.deleteRequest(dbInstance, queryRequest.id);
    const dbRequest = await db.getRequest(dbInstance, queryRequest.id);
    assert.equal(dbRequest, null);
  });
  it("should update request", async function () {
    const createAccessToken: CreateAccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request = mockCreateRequest(createAccessToken.token);
    const queryRequest = await db.saveRequest(dbInstance, request);

    const updateRequest = {
      amount: "20",
      id: queryRequest.id,
      accessTokenHash: queryRequest.access_token_hash,
      createdAt: queryRequest.created_at,
      nodeAddress: queryRequest.node_address,
      chainId: queryRequest.chain_id,
      status: queryRequest.status,
      reason: queryRequest.reason,
      transactionHash: queryRequest.transaction_hash,
    } as UpdateRequest;

    await db.updateRequest(dbInstance, updateRequest);

    const dbUpdatedRequest = await db.getRequest(dbInstance, queryRequest.id);

    assert.equal(dbUpdatedRequest?.amount, 20);
  });
});
