import assert from "assert";
import fs from "fs";
import { IBackup, IMemoryDb, newDb } from "pg-mem";
import * as db from ".";
import { CreateAccessToken, generateAccessToken } from "../access-token";
import { DBInstance } from ".";
import { CreateRequest, UpdateRequest } from "../request";
import { utils } from "@rpch/common";

export class MockPgInstanceSingleton {
  private static pgInstance: IMemoryDb;
  private static dbInstance: DBInstance;
  private static initialDbState: IBackup;

  private constructor() {
    let instance = newDb();
    instance.public.interceptQueries((sql) => {
      const newSql = sql.replace(
        /\bnumeric\s*\(\s*\d+\s*,\s*\d+\s*\)/g,
        "float"
      );
      if (sql !== newSql) {
        return instance.public.many(newSql);
      }
      // proceed to actual SQL execution for other requests.
      return null;
    });
    instance.public.none(fs.readFileSync("dump.sql", "utf8"));
    MockPgInstanceSingleton.pgInstance = instance;
    MockPgInstanceSingleton.initialDbState =
      MockPgInstanceSingleton.pgInstance.backup();
    return MockPgInstanceSingleton.pgInstance;
  }

  public static getInstance(): IMemoryDb {
    return MockPgInstanceSingleton.pgInstance ?? new this();
  }

  public static getDbInstance(): DBInstance {
    if (!MockPgInstanceSingleton.dbInstance) {
      MockPgInstanceSingleton.dbInstance =
        this.getInstance().adapters.createPgPromise();
    }
    return MockPgInstanceSingleton.dbInstance;
  }

  public static backup(): void {
    MockPgInstanceSingleton.initialDbState =
      MockPgInstanceSingleton.pgInstance.backup();
  }

  public static getInitialState(): IBackup {
    return MockPgInstanceSingleton.initialDbState;
  }
}

const mockCreateAccessToken = () => ({
  id: utils.generatePseudoRandomId(1e6),
  createdAt: new Date(Date.now()).toISOString(),
  expiredAt: new Date(Date.now()).toISOString(),
  token: generateAccessToken({
    amount: BigInt(10),
    expiredAt: new Date(),
    secretKey: "secret",
  }),
});

const mockCreateRequest = (hash?: string): CreateRequest => ({
  accessTokenHash: hash ?? "hash",
  amount: BigInt("10"),
  chainId: 80,
  nodeAddress: "address",
  status: "FRESH",
});

const createAccessTokenAndRequest = async (dbInstance: DBInstance) => {
  const createAccessToken: CreateAccessToken = mockCreateAccessToken();
  await db.saveAccessToken(dbInstance, createAccessToken);
  const request = mockCreateRequest(createAccessToken.token);
  const queryRequest = await db.saveRequest(dbInstance, request);
  return queryRequest;
};

describe("test db adapter functions", function () {
  let dbInstance: DBInstance;
  let pgInstance: IMemoryDb;

  beforeAll(async function () {
    pgInstance = MockPgInstanceSingleton.getInstance();
    dbInstance = MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(async function () {
    MockPgInstanceSingleton.getInitialState().restore();
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

    const updateRequest: UpdateRequest = {
      amount: BigInt("20"),
      id: queryRequest.id,
      accessTokenHash: queryRequest.access_token_hash,
      nodeAddress: queryRequest.node_address,
      chainId: queryRequest.chain_id,
      status: queryRequest.status,
      reason: queryRequest.reason,
      transactionHash: queryRequest.transaction_hash,
    };

    await db.updateRequest(dbInstance, updateRequest);

    const dbUpdatedRequest = await db.getRequest(dbInstance, queryRequest.id);

    assert.equal(dbUpdatedRequest?.amount, 20);
  });
  it("should get oldest fresh request", async function () {
    const firstRequest = await createAccessTokenAndRequest(dbInstance);
    if (!firstRequest) throw new Error("request was not created");
    const secondRequest = await createAccessTokenAndRequest(dbInstance);
    const thirdRequest = await createAccessTokenAndRequest(dbInstance);
    const updateFirstRequest = await db.updateRequest(dbInstance, {
      id: firstRequest.id,
      accessTokenHash: firstRequest.access_token_hash,
      nodeAddress: firstRequest.node_address,
      amount: firstRequest.amount,
      chainId: firstRequest.chain_id,
      reason: firstRequest.reason,
      transactionHash: firstRequest.transaction_hash,
      status: "FAILED",
    });
    const oldestFreshRequest = await db.getOldestFreshRequest(dbInstance);
    assert.equal(
      oldestFreshRequest?.access_token_hash,
      secondRequest.access_token_hash
    );
  });
  it("should get all unresolved requests", async function () {
    const firstRequest = await createAccessTokenAndRequest(dbInstance);
    if (!firstRequest) throw new Error("request was not created");
    const secondRequest = await createAccessTokenAndRequest(dbInstance);
    const thirdRequest = await createAccessTokenAndRequest(dbInstance);
    const updateFirstRequest = await db.updateRequest(dbInstance, {
      id: firstRequest.id,
      accessTokenHash: firstRequest.access_token_hash,
      nodeAddress: firstRequest.node_address,
      amount: firstRequest.amount,
      chainId: firstRequest.chain_id,
      reason: firstRequest.reason,
      transactionHash: firstRequest.transaction_hash,
      status: "FAILED",
    });
    const unresolvedRequests = await db.getAllUnresolvedRequests(dbInstance);
    assert.equal(unresolvedRequests?.length, 2);
  });
});
