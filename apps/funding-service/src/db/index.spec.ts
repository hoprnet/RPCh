import assert from "assert";
import * as db from ".";
import { generateAccessToken } from "../utils";
import { Request, RequestDB, AccessToken, DBInstance } from "../types";
import { utils } from "@rpch/common";
import { DBTimestamp } from "../types/general";
import { errors } from "pg-promise";
import { MockPgInstanceSingleton } from "@rpch/common/build/internal/db";
import path from "path";
import * as PgMem from "pg-mem";

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

const mockCreateRequest = (hash?: string, amount?: bigint): Request => ({
  accessTokenHash: hash ?? "hash",
  amount: amount ?? BigInt("10"),
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
    const migrationsDirectory = path.join(__dirname, "../../migrations");
    dbInstance = await MockPgInstanceSingleton.getDbInstance(
      PgMem,
      migrationsDirectory
    );
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
      await db.getAccessToken(dbInstance, createAccessToken.token);
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
    const amountOfTimesToSendRequest = BigInt(3);
    // create access tokens
    const accessTokens = {
      token1: mockCreateAccessToken(),
      token2: mockCreateAccessToken(),
    };

    // activities with token1
    // save access token -> save request
    await db.saveAccessToken(dbInstance, accessTokens.token1);
    const request1 = mockCreateRequest(accessTokens.token1.token);
    await db.saveRequest(dbInstance, request1);

    // activities with token2
    // save access token -> save request x amountOfTimesToSendRequest
    await db.saveAccessToken(dbInstance, accessTokens.token2);
    const request2 = mockCreateRequest(accessTokens.token2.token);
    await Promise.all(
      Array.from({ length: Number(amountOfTimesToSendRequest) }).map(() =>
        db.saveRequest(dbInstance, request2)
      )
    );

    const dbRequestsByAccessToken = await db.getRequests(dbInstance, {
      access_token_hash: accessTokens.token2.token,
    });

    assert.equal(dbRequestsByAccessToken.length, amountOfTimesToSendRequest);
  });
  it("should get sum of requests by access token", async function () {
    const amountOfTimesToSendRequest = BigInt(3);
    // create access tokens
    const accessTokens = {
      token1: mockCreateAccessToken(),
      token2: mockCreateAccessToken(),
    };

    // activities with token1
    // save access token -> save request
    await db.saveAccessToken(dbInstance, accessTokens.token1);
    const request1 = mockCreateRequest(accessTokens.token1.token);
    await db.saveRequest(dbInstance, request1);

    // activities with token2
    // save access token -> save request x amountOfTimesToSendRequest
    await db.saveAccessToken(dbInstance, accessTokens.token2);
    const request2 = mockCreateRequest(accessTokens.token2.token);
    await Promise.all(
      Array.from({ length: Number(amountOfTimesToSendRequest) }).map(() =>
        db.saveRequest(dbInstance, request2)
      )
    );

    const sumOfDbRequestsByAccessToken = await db.getSumOfRequestsByAccessToken(
      dbInstance,
      request2.accessTokenHash
    );

    assert.equal(
      sumOfDbRequestsByAccessToken,
      request2.amount * amountOfTimesToSendRequest
    );
  });
  it("should delete request", async function () {
    const createAccessToken: AccessToken = mockCreateAccessToken();
    await db.saveAccessToken(dbInstance, createAccessToken);
    const request = mockCreateRequest(createAccessToken.token);
    const queryRequest = await db.saveRequest(dbInstance, request);
    await db.deleteRequest(dbInstance, queryRequest.id);
    try {
      await db.getRequest(dbInstance, queryRequest.id);
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
    // thirdRequest
    await createAccessTokenAndRequest(dbInstance);
    // updateFirstRequest
    await db.updateRequest(dbInstance, {
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
    // secondRequest
    await createAccessTokenAndRequest(dbInstance);
    // thirdRequest
    await createAccessTokenAndRequest(dbInstance);
    // updateFirstRequest
    await db.updateRequest(dbInstance, {
      id: firstRequest.id,
      access_token_hash: firstRequest.access_token_hash,
      node_address: firstRequest.node_address,
      amount: firstRequest.amount,
      chain_id: firstRequest.chain_id,
      reason: firstRequest.reason,
      transaction_hash: firstRequest.transaction_hash,
      status: "FAILED",
    });

    const unresolvedRequests = await Promise.all(
      [
        db.getRequests(dbInstance, { status: "FRESH" }),
        db.getRequests(dbInstance, { status: "PROCESSING" }),
      ].flat()
    );

    assert.equal(unresolvedRequests?.length, 2);
  });
  it("should get sum of amount of a group of requests", async function () {
    const mockAccessToken = await db.saveAccessToken(
      dbInstance,
      mockCreateAccessToken()
    );
    const requestAmounts = [
      BigInt("1000000000"),
      BigInt("-1000"),
      BigInt("-1"),
    ];

    // create requests params
    const requestsBodies = requestAmounts.map((amount) =>
      mockCreateRequest(mockAccessToken.token, amount)
    );

    // save requests in db
    await Promise.all(
      requestsBodies.map((req) => db.saveRequest(dbInstance, req))
    );

    const actualSum = await db.getSumOfRequests(dbInstance, {
      access_token_hash: mockAccessToken.token,
    });

    const expectedSum = requestAmounts.reduce(
      (acc, next) => acc + next,
      BigInt(0)
    );

    assert.equal(actualSum, expectedSum);
  });
});
