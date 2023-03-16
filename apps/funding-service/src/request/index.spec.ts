import assert from "assert";
import { RequestDB, DBInstance } from "../types";
import { RequestService } from ".";
import { AccessTokenService } from "../access-token";
import { MockPgInstanceSingleton } from "../db/index.spec";
import { DBTimestamp } from "../types/general";
import { errors } from "pg-promise";

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
  }
) => {
  const queryToken = await accessTokenService.createAccessToken({
    amount: MOCK_AMOUNT,
    timeout: MOCK_TIMEOUT,
  });
  const queryRequest = await requestService.createRequest(
    params
      ? { ...params, accessTokenHash: queryToken.token }
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
    dbInstance = await MockPgInstanceSingleton.getDbInstance();
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
      const deletedRequest = await requestService.getRequest(request.id);
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
    const thirdRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.id,
      {
        id: firstRequest.id,
        access_token_hash: firstRequest.access_token_hash,
        node_address: firstRequest.node_address,
        amount: firstRequest.amount,
        chain_id: firstRequest.chain_id,
        reason: firstRequest.reason,
        transaction_hash: firstRequest.transaction_hash,
        status: "PENDING",
      }
    );
    const oldestFreshRequest = await requestService.getOldestFreshRequest();

    assert.equal(oldestFreshRequest?.id, secondRequest?.id);
  });
  it("should return all unresolved requests", async function () {
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
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.id,
      {
        id: firstRequest.id,
        access_token_hash: firstRequest.access_token_hash,
        node_address: firstRequest.node_address,
        amount: firstRequest.amount,
        chain_id: firstRequest.chain_id,
        reason: firstRequest.reason,
        transaction_hash: firstRequest.transaction_hash,
        status: "FAILED",
      }
    );
    const unresolvedRequests = await requestService.getAllUnresolvedRequests();
    assert.equal(unresolvedRequests?.length, 2);
  });
  it("should return all unresolved requests keyed by chain", async function () {
    const firstRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(1)
    );
    const secondRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(1)
    );
    const thirdRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(2)
    );
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.id,
      {
        id: firstRequest.id,
        access_token_hash: firstRequest.access_token_hash,
        node_address: firstRequest.node_address,
        amount: firstRequest.amount,
        chain_id: firstRequest.chain_id,
        reason: firstRequest.reason,
        transaction_hash: firstRequest.transaction_hash,
        status: "FAILED",
      }
    );
    const unresolvedRequests = await requestService.getAllUnresolvedRequests();
    const unresolvedRequestsKeyedByChain =
      requestService.groupRequestsByChainId(unresolvedRequests ?? []);
    assert.equal(unresolvedRequestsKeyedByChain[1].length, 1);
    assert.equal(unresolvedRequestsKeyedByChain[2].length, 1);
  });
  it("should return sum of all unresolved requests keyed by chain", async function () {
    const firstRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(1)
    );
    const secondRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(1)
    );
    const thirdRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(2)
    );
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.id,
      {
        id: firstRequest.id,
        access_token_hash: firstRequest.access_token_hash,
        node_address: firstRequest.node_address,
        amount: firstRequest.amount,
        chain_id: firstRequest.chain_id,
        reason: firstRequest.reason,
        transaction_hash: firstRequest.transaction_hash,
        status: "FAILED",
      }
    );
    const unresolvedRequests = await requestService.getAllUnresolvedRequests();
    const sumOfAmountByChainId = await requestService.sumAmountOfRequests(
      unresolvedRequests ?? []
    );
    assert.equal(sumOfAmountByChainId[1], MOCK_AMOUNT);
    assert.equal(sumOfAmountByChainId[2], MOCK_AMOUNT);
  });
  it("should calculate available and frozen funds", async function () {
    const firstRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(1)
    );
    const secondRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(1)
    );
    const thirdRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      mockRequestParams(2)
    );
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.id,
      {
        id: firstRequest.id,
        access_token_hash: firstRequest.access_token_hash,
        node_address: firstRequest.node_address,
        amount: firstRequest.amount,
        chain_id: firstRequest.chain_id,
        reason: firstRequest.reason,
        transaction_hash: firstRequest.transaction_hash,
        status: "FAILED",
      }
    );
    const unresolvedRequests = await requestService.getAllUnresolvedRequests();
    const sumOfUnresolvedRequestsByChainId =
      await requestService.sumAmountOfRequests(unresolvedRequests ?? []);

    const availableFunds = await requestService.calculateAvailableFunds(
      sumOfUnresolvedRequestsByChainId,
      sumOfUnresolvedRequestsByChainId
    );
    assert.equal(availableFunds[1], 0);
    assert.equal(availableFunds[2], 0);
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
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.id,
      {
        id: firstRequest.id,
        access_token_hash: firstRequest.access_token_hash,
        node_address: firstRequest.node_address,
        amount: firstRequest.amount,
        chain_id: firstRequest.chain_id,
        reason: firstRequest.reason,
        transaction_hash: firstRequest.transaction_hash,
        status: "FAILED",
      }
    );
    const updateThirdRequest = await requestService.updateRequest(
      thirdRequest.id,
      {
        id: thirdRequest.id,
        access_token_hash: secondRequest.access_token_hash,
        node_address: thirdRequest.node_address,
        amount: thirdRequest.amount,
        chain_id: thirdRequest.chain_id,
        reason: thirdRequest.reason,
        transaction_hash: thirdRequest.transaction_hash,
        status: thirdRequest.status,
      }
    );
    const updateSecondRequest = await requestService.updateRequest(
      secondRequest.id,
      {
        id: secondRequest.id,
        access_token_hash: secondRequest.access_token_hash,
        node_address: secondRequest.node_address,
        amount: secondRequest.amount,
        chain_id: secondRequest.chain_id,
        reason: secondRequest.reason,
        transaction_hash: secondRequest.transaction_hash,
        status: "SUCCESS",
      }
    );
    const allUnresolvedAndSuccessfulRequests =
      await requestService.getAllUnresolvedAndSuccessfulRequestsByAccessToken(
        secondRequest.access_token_hash
      );

    assert.equal(allUnresolvedAndSuccessfulRequests.length, 2);
  });
});
