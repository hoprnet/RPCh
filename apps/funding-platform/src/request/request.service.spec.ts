import assert from "assert";
import { DBInstance } from "../db";
import { UpdateRequest } from "./dto";
import { RequestService } from "./request.service";

const MOCK_ADDRESS = "0xA10AA7711FD1FA48ACAE6FF00FCB63B0F6AD055F";
const MOCK_AMOUNT = "100";
const MOCK_CHAIN_ID = 80;
const MOCK_ACCESS_TOKEN = "4K/9jJxPHzd53UO9dzQ3xLeRHhPWgMWhAxbrQloiZB4=";
const REQUEST_PARAMS = {
  address: MOCK_ADDRESS,
  amount: MOCK_AMOUNT,
  accessTokenHash: MOCK_ACCESS_TOKEN,
  chainId: MOCK_CHAIN_ID,
};
const mockRequestParams = (chainId: number) => ({
  address: MOCK_ADDRESS,
  amount: MOCK_AMOUNT,
  accessTokenHash: MOCK_ACCESS_TOKEN,
  chainId: chainId ?? MOCK_CHAIN_ID,
});

describe("test RequestService class", function () {
  let requestService: RequestService;
  beforeEach(function () {
    let db = {
      data: { accessTokens: [], requests: [] },
    } as unknown as DBInstance;
    requestService = new RequestService(db);
  });
  it("should create and save request", async function () {
    const request = await requestService.createRequest(REQUEST_PARAMS);
    if (!request) throw new Error("request was not created");
    const createdRequest = await requestService.getRequest(request.requestId);
    assert.equal(createdRequest?.nodeAddress, MOCK_ADDRESS);
    assert.equal(createdRequest?.amount, MOCK_AMOUNT);
  });
  it("should get requests", async function () {
    await requestService.createRequest(REQUEST_PARAMS);
    await requestService.createRequest(REQUEST_PARAMS);

    const requestsByAccessToken = await requestService.getRequests();

    assert.equal(requestsByAccessToken?.length, 2);
  });
  it("should get request by request id", async function () {
    await requestService.createRequest(REQUEST_PARAMS);
    const request = await requestService.createRequest(REQUEST_PARAMS);
    if (!request) throw new Error("request was not created");
    const createdRequest = await requestService.getRequest(request.requestId);
    assert.equal(createdRequest?.nodeAddress, MOCK_ADDRESS);
    assert.equal(createdRequest?.amount, MOCK_AMOUNT);
  });
  it("should update request", async function () {
    const request = await requestService.createRequest(REQUEST_PARAMS);
    if (!request) throw new Error("request was not created");
    const updateRequest = {
      ...request,
      amount: String(2 * Number(MOCK_AMOUNT)),
    } as UpdateRequest;

    await requestService.updateRequest(request.requestId, updateRequest);

    const updatedRequest = await requestService.getRequest(request.requestId);

    assert.notEqual(updatedRequest?.amount, request.amount);
  });
  it("should delete request", async function () {
    const request = await requestService.createRequest(REQUEST_PARAMS);
    if (!request) throw new Error("request was not created");
    await requestService.deleteRequest(request.requestId);

    const deletedRequest = await requestService.getRequest(request.requestId);

    assert.equal(deletedRequest, undefined);
  });
  it("should return oldest unhandled request", async function () {
    const firstRequest = await requestService.createRequest(REQUEST_PARAMS);
    if (!firstRequest) throw new Error("request was not created");
    const secondRequest = await requestService.createRequest(REQUEST_PARAMS);
    const thirdRequest = await requestService.createRequest(REQUEST_PARAMS);
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.requestId,
      { ...firstRequest, status: "PENDING" }
    );
    const oldestFreshRequest = await requestService.getOldestFreshRequest();

    assert.equal(oldestFreshRequest?.requestId, secondRequest?.requestId);
  });
  it("should return all compromised requests", async function () {
    const firstRequest = await requestService.createRequest(REQUEST_PARAMS);
    if (!firstRequest) throw new Error("request was not created");
    const secondRequest = await requestService.createRequest(REQUEST_PARAMS);
    const thirdRequest = await requestService.createRequest(REQUEST_PARAMS);
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.requestId,
      { ...firstRequest, status: "FAILED" }
    );
    const compromisedRequests = await requestService.getAllUnresolvedRequests();
    assert.equal(compromisedRequests?.length, 2);
  });
  it("should return all compromised requests keyed by chain", async function () {
    const firstRequest = await requestService.createRequest(
      mockRequestParams(1)
    );
    if (!firstRequest) throw new Error("request was not created");
    const secondRequest = await requestService.createRequest(
      mockRequestParams(1)
    );
    const thirdRequest = await requestService.createRequest(
      mockRequestParams(2)
    );
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.requestId,
      { ...firstRequest, status: "FAILED" }
    );
    const compromisedRequests = await requestService.getAllUnresolvedRequests();
    const compromisedRequestsKeyedByChain =
      requestService.groupRequestsByChainId(compromisedRequests ?? []);
    assert.equal(compromisedRequestsKeyedByChain[1].length, 1);
    assert.equal(compromisedRequestsKeyedByChain[2].length, 1);
  });
  it("should return sum of all compromised requests keyed by chain", async function () {
    const firstRequest = await requestService.createRequest(
      mockRequestParams(1)
    );
    if (!firstRequest) throw new Error("request was not created");
    const secondRequest = await requestService.createRequest(
      mockRequestParams(1)
    );
    const thirdRequest = await requestService.createRequest(
      mockRequestParams(2)
    );
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.requestId,
      { ...firstRequest, status: "FAILED" }
    );
    const compromisedRequests = await requestService.getAllUnresolvedRequests();
    const sumOfAmountByChainId = await requestService.sumAmountOfRequests(
      compromisedRequests ?? []
    );
    assert.equal(sumOfAmountByChainId[1], MOCK_AMOUNT);
    assert.equal(sumOfAmountByChainId[2], MOCK_AMOUNT);
  });
  it("should calculate available and frozen funds", async function () {
    const firstRequest = await requestService.createRequest(
      mockRequestParams(1)
    );
    if (!firstRequest) throw new Error("request was not created");
    const secondRequest = await requestService.createRequest(
      mockRequestParams(1)
    );
    const thirdRequest = await requestService.createRequest(
      mockRequestParams(2)
    );
    const updateFirstRequest = await requestService.updateRequest(
      firstRequest.requestId,
      { ...firstRequest, status: "FAILED" }
    );
    const compromisedRequests = await requestService.getAllUnresolvedRequests();
    const sumOfCompromisedRequestsByChainId =
      await requestService.sumAmountOfRequests(compromisedRequests ?? []);

    const availableFunds = await requestService.calculateAvailableFunds(
      sumOfCompromisedRequestsByChainId,
      sumOfCompromisedRequestsByChainId
    );
    assert.equal(availableFunds[1], 0);
    assert.equal(availableFunds[2], 0);
  });
});
