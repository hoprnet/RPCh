import assert from "assert";
import { DBInstance } from "../db";
import { UpdateRequest } from "./dto";
import { RequestService } from "./request.service";

const MOCK_ADDRESS = "0xA10AA7711FD1FA48ACAE6FF00FCB63B0F6AD055F";
const MOCK_AMOUNT = 100;
const MOCK_CHAIN_ID = 80;
const MOCK_ACCESS_TOKEN = "4K/9jJxPHzd53UO9dzQ3xLeRHhPWgMWhAxbrQloiZB4=";

describe("test RequestService class", function () {
  let requestService: RequestService;
  beforeEach(function () {
    let db = {
      data: { accessTokens: [], requests: [] },
    } as unknown as DBInstance;
    requestService = new RequestService(db);
  });
  it("should create and save request", async function () {
    const request = await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: MOCK_CHAIN_ID,
    });
    const createdRequest = await requestService.getRequest(request.requestId);
    assert.equal(createdRequest?.nodeAddress, MOCK_ADDRESS);
    assert.equal(createdRequest?.amount, MOCK_AMOUNT);
  });
  it("should get requests", async function () {
    await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: MOCK_CHAIN_ID,
    });
    await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: MOCK_CHAIN_ID,
    });

    const requestsByAccessToken = await requestService.getRequests();

    assert.equal(requestsByAccessToken?.length, 2);
  });
  it("should get request by request id", async function () {
    await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: MOCK_CHAIN_ID,
    });
    const request = await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: MOCK_CHAIN_ID,
    });
    const createdRequest = await requestService.getRequest(request.requestId);
    assert.equal(createdRequest?.nodeAddress, MOCK_ADDRESS);
    assert.equal(createdRequest?.amount, MOCK_AMOUNT);
  });
  it("should update request", async function () {
    const request = await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: MOCK_CHAIN_ID,
    });

    const updateRequest = {
      ...request,
      amount: 2 * MOCK_AMOUNT,
    } as UpdateRequest;

    await requestService.updateRequest(request.requestId, updateRequest);

    const updatedRequest = await requestService.getRequest(request.requestId);

    assert.notEqual(updatedRequest?.amount, request.amount);
  });
  it("should delete request", async function () {
    const request = await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: MOCK_CHAIN_ID,
    });

    await requestService.deleteRequest(request.requestId);

    const deletedRequest = await requestService.getRequest(request.requestId);

    assert.equal(deletedRequest, undefined);
  });
});
