import assert from "assert";
import { RequestDB, DBInstance } from "../types";
import { RequestService } from ".";
import { AccessTokenService } from "../access-token";
import { DBTimestamp } from "../types/general";
import { errors } from "pg-promise";
import * as constants from "../constants";
import { MockPgInstanceSingleton } from "@rpch/common/build/internal/db";
import path from "path";
import * as PgMem from "pg-mem";

const SECRET_KEY = "SECRET";
const MOCK_ADDRESS = "0xA10AA7711FD1FA48ACAE6FF00FCB63B0F6AD055F";
const MOCK_AMOUNT = BigInt("100");
const MOCK_CHAIN_ID = 80;
const MOCK_TIMEOUT = 3000;

const mockRequestParams = (chainId: number) => ({
  amount: MOCK_AMOUNT,
  chainId: chainId ?? MOCK_CHAIN_ID,
  status: "FRESH",
  nodeAddress: MOCK_ADDRESS,
});

const createAccessTokenAndRequest = async (
  accessTokenService: AccessTokenService,
  requestService: RequestService,
  params?: {
    nodeAddress: string;
    amount: bigint;
    chainId: number;
    token?: string;
  }
) => {
  const queryToken = await accessTokenService.createAccessToken({
    amount: MOCK_AMOUNT,
    timeout: MOCK_TIMEOUT,
  });
  const queryRequest = await requestService.createRequest(
    params
      ? { ...params, accessTokenHash: params.token ?? queryToken.token }
      : {
          accessTokenHash: queryToken.token,
          amount: MOCK_AMOUNT,
          chainId: MOCK_CHAIN_ID,
          nodeAddress: MOCK_ADDRESS,
        }
  );
  return queryRequest;
};

describe("test RequestService class", function () {
  let dbInstance: DBInstance;
  let requestService: RequestService;
  let accessTokenService: AccessTokenService;

  beforeAll(async function () {
    const migrationsDirectory = path.join(__dirname, "../../migrations");
    dbInstance = await MockPgInstanceSingleton.getDbInstance(
      PgMem,
      migrationsDirectory
    );
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(function () {
    MockPgInstanceSingleton.getInitialState().restore();
    accessTokenService = new AccessTokenService(dbInstance, SECRET_KEY);
    requestService = new RequestService(dbInstance);
  });

  it("should create and save request", async function () {
    const request = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    const createdRequest = await requestService.getRequest(request.id);
    assert.equal(createdRequest?.node_address, MOCK_ADDRESS);
    assert.equal(createdRequest?.amount, MOCK_AMOUNT);
  });
  it("should get requests", async function () {
    await createAccessTokenAndRequest(accessTokenService, requestService);
    await createAccessTokenAndRequest(accessTokenService, requestService);

    const requestsByAccessToken = await requestService.getRequests();

    assert.equal(requestsByAccessToken?.length, 2);
  });
  it("should get request by request id", async function () {
    await createAccessTokenAndRequest(accessTokenService, requestService);
    const request = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    const createdRequest = await requestService.getRequest(request.id);
    assert.equal(createdRequest?.node_address, MOCK_ADDRESS);
    assert.equal(createdRequest?.amount, MOCK_AMOUNT);
  });
  it("should update request", async function () {
    const request = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    const updateRequest: Omit<RequestDB, keyof DBTimestamp> = {
      access_token_hash: request.access_token_hash,
      chain_id: request.chain_id,
      id: request.id,
      node_address: request.node_address,
      amount: BigInt(2 * Number(MOCK_AMOUNT)),
      status: request.status,
    };

    await requestService.updateRequest(request.id, updateRequest);

    const updatedRequest = await requestService.getRequest(request.id);

    assert.notEqual(updatedRequest?.amount, request.amount);
  });
  it("should delete request", async function () {
    const request = await await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    await requestService.deleteRequest(request.id);

    try {
      // deletedRequest
      await requestService.getRequest(request.id);
    } catch (e) {
      if (e instanceof errors.QueryResultError) {
        assert.equal(e.message, "No data returned from the query.");
      }
    }
  });
  it("should return oldest unhandled request", async function () {
    const firstRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    const secondRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    // thirdRequest
    await createAccessTokenAndRequest(accessTokenService, requestService);
    //  updateFirstRequest
    await requestService.updateRequest(firstRequest.id, {
      id: firstRequest.id,
      access_token_hash: firstRequest.access_token_hash,
      node_address: firstRequest.node_address,
      amount: firstRequest.amount,
      chain_id: firstRequest.chain_id,
      reason: firstRequest.reason,
      transaction_hash: firstRequest.transaction_hash,
      status: "PENDING",
    });
    const oldestFreshRequest = await requestService.getOldestFreshRequest();

    assert.equal(oldestFreshRequest?.id, secondRequest?.id);
  });
  it("should return all unresolved requests", async function () {
    const firstRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    // secondRequest
    await createAccessTokenAndRequest(accessTokenService, requestService);
    // thirdRequest
    await createAccessTokenAndRequest(accessTokenService, requestService);
    //  updateFirstRequest
    await requestService.updateRequest(firstRequest.id, {
      id: firstRequest.id,
      access_token_hash: firstRequest.access_token_hash,
      node_address: firstRequest.node_address,
      amount: firstRequest.amount,
      chain_id: firstRequest.chain_id,
      reason: firstRequest.reason,
      transaction_hash: firstRequest.transaction_hash,
      status: "FAILED",
    });
    const unresolvedRequests = await requestService.getUnresolvedRequests();
    assert.equal(unresolvedRequests?.length, 2);
  });
  it("should return all unresolved requests keyed by chain", async function () {
    const firstRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(1)
    );
    // secondRequest
    await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(1)
    );
    // thirdRequest
    await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(2)
    );
    // updateFirstRequest
    await requestService.updateRequest(firstRequest.id, {
      id: firstRequest.id,
      access_token_hash: firstRequest.access_token_hash,
      node_address: firstRequest.node_address,
      amount: firstRequest.amount,
      chain_id: firstRequest.chain_id,
      reason: firstRequest.reason,
      transaction_hash: firstRequest.transaction_hash,
      status: "FAILED",
    });
    const unresolvedRequests = await requestService.getUnresolvedRequests();
    const unresolvedRequestsKeyedByChain =
      requestService.groupRequestsByChainId(unresolvedRequests ?? []);
    assert.equal(unresolvedRequestsKeyedByChain[1].length, 1);
    assert.equal(unresolvedRequestsKeyedByChain[2].length, 1);
  });
  it("should return all successful and unresolved requests by access token", async function () {
    const firstRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    const secondRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    const thirdRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    // updateFirstRequest
    await requestService.updateRequest(firstRequest.id, {
      id: firstRequest.id,
      access_token_hash: firstRequest.access_token_hash,
      node_address: firstRequest.node_address,
      amount: firstRequest.amount,
      chain_id: firstRequest.chain_id,
      reason: firstRequest.reason,
      transaction_hash: firstRequest.transaction_hash,
      status: "FAILED",
    });
    // updateThirdRequest
    await requestService.updateRequest(thirdRequest.id, {
      id: thirdRequest.id,
      access_token_hash: secondRequest.access_token_hash,
      node_address: thirdRequest.node_address,
      amount: thirdRequest.amount,
      chain_id: thirdRequest.chain_id,
      reason: thirdRequest.reason,
      transaction_hash: thirdRequest.transaction_hash,
      status: thirdRequest.status,
    });
    // updateSecondRequest
    await requestService.updateRequest(secondRequest.id, {
      id: secondRequest.id,
      access_token_hash: secondRequest.access_token_hash,
      node_address: secondRequest.node_address,
      amount: secondRequest.amount,
      chain_id: secondRequest.chain_id,
      reason: secondRequest.reason,
      transaction_hash: secondRequest.transaction_hash,
      status: "SUCCESS",
    });
    const allUnresolvedAndSuccessfulRequests =
      await requestService.getUnresolvedAndSuccessfulRequests(
        secondRequest.access_token_hash
      );

    assert.equal(allUnresolvedAndSuccessfulRequests.length, 2);
  });
  it("should get sum of amount of a group of requests", async function () {
    // create un resolved requests
    const unresolvedRequestsAmounts = [
      BigInt("1000000000"),
      BigInt("-1000"),
      BigInt("-1"),
    ];

    // save un resolved requests to db
    await Promise.all(
      unresolvedRequestsAmounts.map((amount) =>
        createAccessTokenAndRequest(accessTokenService, requestService, {
          amount,
          chainId: 100,
          nodeAddress: "address",
        })
      )
    );

    // create successful requests
    const successfulRequestsAmounts = [
      BigInt("-1000"),
      BigInt("-1000"),
      BigInt("-1"),
    ];

    // save successful requests to db
    await Promise.all(
      successfulRequestsAmounts.map((amount) =>
        createAccessTokenAndRequest(accessTokenService, requestService, {
          amount,
          chainId: 100,
          nodeAddress: "address",
        })
      )
    );

    const actualSum = await requestService.getSumOfRequestsByStatus([
      ...constants.UNRESOLVED_REQUESTS_STATUSES,
      "SUCCESS",
    ]);

    const expectedSum = [
      ...successfulRequestsAmounts,
      ...unresolvedRequestsAmounts,
    ].reduce((acc, next) => acc + next, BigInt(0));

    assert.equal(actualSum, expectedSum);
  });
  it("should get sum of amount of a group of requests with same access token", async function () {
    const mockToken = await accessTokenService.createAccessToken({
      amount: MOCK_AMOUNT,
      timeout: MOCK_CHAIN_ID,
    });

    // create un resolved requests
    const unresolvedRequestsAmounts = [
      BigInt("1000000000"),
      BigInt("-1000"),
      BigInt("-1"),
    ];

    // save un resolved requests to db
    await Promise.all(
      unresolvedRequestsAmounts.map((amount) =>
        createAccessTokenAndRequest(accessTokenService, requestService, {
          amount,
          chainId: 100,
          nodeAddress: "address",
          token: mockToken.token,
        })
      )
    );

    // create successful requests
    const successfulRequestsAmounts = [
      BigInt("-1000"),
      BigInt("-1000"),
      BigInt("-1"),
    ];

    // save successful requests to db
    await Promise.all(
      successfulRequestsAmounts.map((amount) =>
        createAccessTokenAndRequest(accessTokenService, requestService, {
          amount,
          chainId: 100,
          nodeAddress: "address",
          token: mockToken.token,
        })
      )
    );

    // save successful requests with random access token (absence of token will make it random)
    await Promise.all(
      successfulRequestsAmounts.map((amount) =>
        createAccessTokenAndRequest(accessTokenService, requestService, {
          amount,
          chainId: 100,
          nodeAddress: "address",
        })
      )
    );

    const actualSum = await requestService.getSumOfRequestsByStatus(
      [...constants.UNRESOLVED_REQUESTS_STATUSES, "SUCCESS"],
      mockToken.token
    );

    const expectedSum = [
      ...successfulRequestsAmounts,
      ...unresolvedRequestsAmounts,
    ].reduce((acc, next) => acc + next, BigInt(0));

    assert.equal(actualSum, expectedSum);
  });
});
