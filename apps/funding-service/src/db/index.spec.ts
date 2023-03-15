import assert from "assert";
import fs from "fs";
import { IBackup, IMemoryDb, newDb } from "pg-mem";
import * as db from ".";
import { generateAccessToken } from "../utils";
import { DBInstance } from ".";
import { Request, RequestDB, AccessToken } from "../types";
import { utils } from "@rpch/common";
import path from "path";
import * as fixtures from "@rpch/common/build/fixtures";
import { DBTimestamp } from "../types/general";
import { errors } from "pg-promise";

export class MockPgInstanceSingleton {
  private static pgInstance: IMemoryDb;
  private static dbInstance: db.DBInstance;
  private static initialDbState: IBackup;

  private constructor() {}

  private async createInstance() {
    const migrationsDirectory = path.join(__dirname, "../../migrations");
    let instance = newDb();
    fixtures.withQueryIntercept(instance);
    await instance.public.migrate({ migrationsPath: migrationsDirectory });
    MockPgInstanceSingleton.pgInstance = instance;
    MockPgInstanceSingleton.initialDbState =
      MockPgInstanceSingleton.pgInstance.backup();
    return MockPgInstanceSingleton.pgInstance;
  }

  public static async getInstance(): Promise<IMemoryDb> {
    if (!MockPgInstanceSingleton.pgInstance) {
      await new this().createInstance();
    }
    return MockPgInstanceSingleton.pgInstance;
  }

  public static async getDbInstance(): Promise<db.DBInstance> {
    if (!MockPgInstanceSingleton.dbInstance) {
      const instance = await this.getInstance();
      MockPgInstanceSingleton.dbInstance = instance.adapters.createPgPromise();
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

const mockCreateRequest = (hash?: string): Request => ({
  accessTokenHash: hash ?? "hash",
  amount: BigInt("10"),
  chainId: 80,
  nodeAddress: "address",
  status: "FRESH",
});

const createAccessTokenAndRequest = async (dbInstance: DBInstance) => {
  const createAccessToken: AccessToken = mockCreateAccessToken();
  await db.saveAccessToken(dbInstance, createAccessToken);
  const request = mockCreateRequest(createAccessToken.token);
  const queryRequest = await db.saveRequest(dbInstance, request);
  return queryRequest;
};

describe("test db adapter functions", function () {
  let dbInstance: DBInstance;

  beforeAll(async function () {
    dbInstance = await MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(async function () {
    MockPgInstanceSingleton.getInitialState().restore();
  });

  it("should save access token", async function () {
    const createAccessToken: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken.token
    );
    assert(dbAccessToken?.token, createAccessToken.token);
  });
  it("should get access token", async function () {
    const createAccessToken1: AccessToken = mockCreateAccessToken();
    const createAccessToken2: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken1);
    await db.saveAccessToken(dbInstance, createAccessToken2);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken2.token
    );
    assert(dbAccessToken.token, createAccessToken2.token);
  });
  it("should delete access token", async function () {
    const createAccessToken: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    await db.deleteAccessToken(dbInstance, createAccessToken.token);
    try {
      const dbAccessToken = await db.getAccessToken(
        dbInstance,
        createAccessToken.token
      );
    } catch (e) {
      if (e instanceof errors.QueryResultError) {
        assert.equal(e.message, "No data returned from the query.");
      }
    }
  });
  it("should save request", async function () {
    const createAccessToken: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request = mockCreateRequest(createAccessToken.token);
    const queryRequest = await db.saveRequest(dbInstance, request);
    const dbRequest = await db.getRequest(dbInstance, queryRequest.id);
    assert.equal(request.accessTokenHash, dbRequest.access_token_hash);
  });
  it("should get request by id", async function () {
    const createAccessToken: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request1 = mockCreateRequest(createAccessToken.token);
    await db.saveRequest(dbInstance, request1);

    const createAccessToken2: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken2);
    const request2 = mockCreateRequest(createAccessToken2.token);

    const queryRequest2 = await db.saveRequest(dbInstance, request2);

    const dbRequest = await db.getRequest(dbInstance, queryRequest2.id);

    assert.equal(dbRequest?.access_token_hash, request2.accessTokenHash);
  });
  it("should get requests", async function () {
    const createAccessToken: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request1 = mockCreateRequest(createAccessToken.token);
    await db.saveRequest(dbInstance, request1);

    const createAccessToken2: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken2);
    const request2 = mockCreateRequest(createAccessToken2.token);
    await db.saveRequest(dbInstance, request2);

    const dbRequestsByAccessToken = await db.getRequests(dbInstance);

    assert.equal(dbRequestsByAccessToken.length, 2);
  });
  it("should get requests by access token", async function () {
    const createAccessToken: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request1 = mockCreateRequest(createAccessToken.token);
    await db.saveRequest(dbInstance, request1);

    const createAccessToken2: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken2);
    const request2 = mockCreateRequest(createAccessToken2.token);
    await db.saveRequest(dbInstance, request2);

    const dbRequestsByAccessToken = await db.getRequestsByAccessToken(
      dbInstance,
      request2.accessTokenHash
    );

    assert.equal(dbRequestsByAccessToken.length, 1);
  });
  it("should delete request", async function () {
    const createAccessToken: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request = mockCreateRequest(createAccessToken.token);
    const queryRequest = await db.saveRequest(dbInstance, request);
    await db.deleteRequest(dbInstance, queryRequest.id);
    try {
      const dbRequest = await db.getRequest(dbInstance, queryRequest.id);
    } catch (e) {
      if (e instanceof errors.QueryResultError) {
        assert.equal(e.message, "No data returned from the query.");
      }
    }
  });
  it("should update request", async function () {
    const createAccessToken: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request = mockCreateRequest(createAccessToken.token);
    const queryRequest = await db.saveRequest(dbInstance, request);

    const updateRequest: Omit<RequestDB, keyof DBTimestamp> = {
      amount: BigInt("20"),
      id: queryRequest.id,
      access_token_hash: queryRequest.access_token_hash,
      node_address: queryRequest.node_address,
      chain_id: queryRequest.chain_id,
      status: queryRequest.status,
      reason: queryRequest.reason,
      transaction_hash: queryRequest.transaction_hash,
    };

    await db.updateRequest(dbInstance, updateRequest);

    const dbUpdatedRequest = await db.getRequest(dbInstance, queryRequest.id);

    assert.equal(dbUpdatedRequest.amount, 20);
  });
  it("should get oldest fresh request", async function () {
    const firstRequest = await createAccessTokenAndRequest(dbInstance);
    const secondRequest = await createAccessTokenAndRequest(dbInstance);
    const thirdRequest = await createAccessTokenAndRequest(dbInstance);
    const updateFirstRequest = await db.updateRequest(dbInstance, {
      id: firstRequest.id,
      access_token_hash: firstRequest.access_token_hash,
      node_address: firstRequest.node_address,
      amount: firstRequest.amount,
      chain_id: firstRequest.chain_id,
      reason: firstRequest.reason,
      transaction_hash: firstRequest.transaction_hash,
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
    const secondRequest = await createAccessTokenAndRequest(dbInstance);
    const thirdRequest = await createAccessTokenAndRequest(dbInstance);
    const updateFirstRequest = await db.updateRequest(dbInstance, {
      id: firstRequest.id,
      access_token_hash: firstRequest.access_token_hash,
      node_address: firstRequest.node_address,
      amount: firstRequest.amount,
      chain_id: firstRequest.chain_id,
      reason: firstRequest.reason,
      transaction_hash: firstRequest.transaction_hash,
      status: "FAILED",
    });
    const unresolvedRequests = await db.getAllUnresolvedRequests(dbInstance);

    assert.equal(unresolvedRequests?.length, 2);
  });
});
