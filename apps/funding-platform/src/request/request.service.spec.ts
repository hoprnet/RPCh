import assert from "assert";
import { DBInstance } from "../db";
import { UpdateRequest } from "./dto";
import { RequestService } from "./request.service";
import { AccessTokenService } from "../access-token";
import { IMemoryDb } from "pg-mem";
import { MockPgInstanceSingleton } from "../db/index.spec";

const SECRET_KEY = "SECRET";
const MOCK_ADDRESS = "0xA10AA7711FD1FA48ACAE6FF00FCB63B0F6AD055F";
const MOCK_AMOUNT = "100";
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
    amount: string;
    chainId: number;
  }
) => {
  const queryToken = await accessTokenService.createAccessToken({
    amount: Number(MOCK_AMOUNT),
    timeout: MOCK_TIMEOUT,
  });
  if (!queryToken) throw new Error("Failed to create test token");
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
  let pgInstance: IMemoryDb;
  let requestService: RequestService;
  let accessTokenService: AccessTokenService;

  beforeAll(async function () {
    pgInstance = MockPgInstanceSingleton.getInstance();
    dbInstance = MockPgInstanceSingleton.getDbInstance();
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
    if (!request) throw new Error("request was not created");
    const createdRequest = await requestService.getRequest(request.id);
    assert.equal(createdRequest?.node_address, MOCK_ADDRESS);
    assert.equal(createdRequest?.amount, MOCK_AMOUNT);
  });
  it("should get requests", async function () {
    await await createAccessTokenAndRequest(accessTokenService, requestService);
    await await createAccessTokenAndRequest(accessTokenService, requestService);

    const requestsByAccessToken = await requestService.getRequests();

    assert.equal(requestsByAccessToken?.length, 2);
  });
  it("should get request by request id", async function () {
    await await createAccessTokenAndRequest(accessTokenService, requestService);
    const request = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    if (!request) throw new Error("request was not created");
    const createdRequest = await requestService.getRequest(request.id);
    assert.equal(createdRequest?.node_address, MOCK_ADDRESS);
    assert.equal(createdRequest?.amount, MOCK_AMOUNT);
  });
  it("should update request", async function () {
    const request = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    if (!request) throw new Error("request was not created");
    const updateRequest = {
      accessTokenHash: request.access_token_hash,
      chainId: request.chain_id,
      createdAt: request.created_at,
      id: request.id,
      nodeAddress: request.node_address,
      amount: String(2 * Number(MOCK_AMOUNT)),
      status: request.status,
    } as UpdateRequest;

    await requestService.updateRequest(request.id, updateRequest);

    const updatedRequest = await requestService.getRequest(request.id);

    assert.notEqual(updatedRequest?.amount, request.amount);
  });
  it("should delete request", async function () {
    const request = await await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    if (!request) throw new Error("request was not created");
    await requestService.deleteRequest(request.id);

    const deletedRequest = await requestService.getRequest(request.id);

    assert.equal(deletedRequest, undefined);
  });
  it("should return oldest unhandled request", async function () {
    const firstRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    if (!firstRequest) throw new Error("request was not created");
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
        accessTokenHash: firstRequest.access_token_hash,
        nodeAddress: firstRequest.node_address,
        amount: firstRequest.amount,
        chainId: firstRequest.chain_id,
        reason: firstRequest.reason,
        transactionHash: firstRequest.transaction_hash,
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
    if (!firstRequest) throw new Error("request was not created");
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
        accessTokenHash: firstRequest.access_token_hash,
        nodeAddress: firstRequest.node_address,
        amount: firstRequest.amount,
        chainId: firstRequest.chain_id,
        reason: firstRequest.reason,
        transactionHash: firstRequest.transaction_hash,
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
    if (!firstRequest) throw new Error("request was not created");
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
        accessTokenHash: firstRequest.access_token_hash,
        nodeAddress: firstRequest.node_address,
        amount: firstRequest.amount,
        chainId: firstRequest.chain_id,
        reason: firstRequest.reason,
        transactionHash: firstRequest.transaction_hash,
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
    if (!firstRequest) throw new Error("request was not created");
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
        accessTokenHash: firstRequest.access_token_hash,
        nodeAddress: firstRequest.node_address,
        amount: firstRequest.amount,
        chainId: firstRequest.chain_id,
        reason: firstRequest.reason,
        transactionHash: firstRequest.transaction_hash,
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
    if (!firstRequest) throw new Error("request was not created");
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
        accessTokenHash: firstRequest.access_token_hash,
        nodeAddress: firstRequest.node_address,
        amount: firstRequest.amount,
        chainId: firstRequest.chain_id,
        reason: firstRequest.reason,
        transactionHash: firstRequest.transaction_hash,
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
    if (!firstRequest) throw new Error("request was not created");
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
        accessTokenHash: firstRequest.access_token_hash,
        nodeAddress: firstRequest.node_address,
        amount: firstRequest.amount,
        chainId: firstRequest.chain_id,
        reason: firstRequest.reason,
        transactionHash: firstRequest.transaction_hash,
        status: "FAILED",
      }
    );
    const updateThirdRequest = await requestService.updateRequest(
      thirdRequest.id,
      {
        id: thirdRequest.id,
        accessTokenHash: secondRequest.access_token_hash,
        nodeAddress: thirdRequest.node_address,
        amount: thirdRequest.amount,
        chainId: thirdRequest.chain_id,
        reason: thirdRequest.reason,
        transactionHash: thirdRequest.transaction_hash,
        status: thirdRequest.status,
      }
    );
    const updateSecondRequest = await requestService.updateRequest(
      secondRequest.id,
      {
        id: secondRequest.id,
        accessTokenHash: secondRequest.access_token_hash,
        nodeAddress: secondRequest.node_address,
        amount: secondRequest.amount,
        chainId: secondRequest.chain_id,
        reason: secondRequest.reason,
        transactionHash: secondRequest.transaction_hash,
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
