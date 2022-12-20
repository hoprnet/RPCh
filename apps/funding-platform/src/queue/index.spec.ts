import { ethers } from "hardhat";
import assert from "assert";
import { DBInstance } from "../db";
import { checkFreshRequests } from ".";
import { RequestService } from "../request";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

const MOCK_ADDRESS = "0xA10AA7711FD1FA48ACAE6FF00FCB63B0F6AD055F";
const MOCK_AMOUNT = "100";
const MOCK_CHAIN_ID = 31337;
const MOCK_ACCESS_TOKEN = "4K/9jJxPHzd53UO9dzQ3xLeRHhPWgMWhAxbrQloiZB4=";

describe("test index.ts", function () {
  let requestService: RequestService;
  let accounts: SignerWithAddress[];
  let provider: JsonRpcProvider;
  beforeEach(async function () {
    const dbInstance = {
      data: {
        requests: [],
        accessTokens: [],
      },
    } as unknown as DBInstance;
    accounts = await ethers.getSigners();
    provider = ethers.provider;
    requestService = new RequestService(dbInstance);
  });
  it("should handle fresh requests", async function () {
    const [owner] = accounts;
    const createRequest = await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: MOCK_CHAIN_ID,
    });
    if (!createRequest) throw new Error("request was not created");
    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
    });
    const queryRequest = await requestService.getRequest(
      createRequest.requestId
    );
    assert.equal(queryRequest?.status, "SUCCESS");
  });
  it("should avoid requests that are not fresh", async function () {
    const [owner] = accounts;
    const createRequest = await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: MOCK_CHAIN_ID,
    });
    if (!createRequest) throw new Error("request was not created");
    await requestService.updateRequest(createRequest.requestId, {
      ...createRequest,
      status: "REJECTED-DURING-PROCESSING",
    });
    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
    });
    const queryRequest = await requestService.getRequest(
      createRequest.requestId
    );
    assert.equal(queryRequest?.status, "REJECTED-DURING-PROCESSING");
  });
  it("should fail if signer does not have enough to fund request", async function () {
    const [owner] = accounts;
    await setBalance(owner.address, 0);
    const createRequest = await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: MOCK_CHAIN_ID,
    });
    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
    });
    const queryRequest = await requestService.getRequest(
      createRequest.requestId
    );
    assert.equal(
      queryRequest?.reason,
      "Signer does not have enough balance to fund request"
    );
    assert.equal(queryRequest?.status, "REJECTED-DURING-PROCESSING");
  });
  it("should fail if request does not have chain id", async function () {
    const [owner] = accounts;
    await setBalance(owner.address, 0);
    const createRequest = await requestService.createRequest({
      address: MOCK_ADDRESS,
      amount: MOCK_AMOUNT,
      accessTokenHash: MOCK_ACCESS_TOKEN,
      chainId: 0,
    });
    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
    });
    const queryRequest = await requestService.getRequest(
      createRequest.requestId
    );
    assert.equal(queryRequest?.reason, "Request is missing chainId");
    assert.equal(queryRequest?.status, "REJECTED-DURING-PROCESSING");
  });
});
