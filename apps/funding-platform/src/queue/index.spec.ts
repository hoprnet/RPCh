import { JsonRpcProvider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import assert from "assert";
import { ethers } from "hardhat";
import { IBackup, IMemoryDb } from "pg-mem";
import { checkFreshRequests } from ".";
import { AccessTokenService } from "../access-token";
import { DBInstance } from "../db";
import { MockPgInstanceSingleton } from "../db/index.spec";
import { RequestService } from "../request";

const MOCK_ADDRESS = "0xA10AA7711FD1FA48ACAE6FF00FCB63B0F6AD055F";
const MOCK_AMOUNT = "1000";
const MOCK_CHAIN_ID = 31337;
const MOCK_TIMEOUT = 3000;

const INITIAL_AMOUNT = ethers.utils.parseEther(MOCK_AMOUNT).toString();

jest.mock("../blockchain", () => {
  return {
    ...jest.requireActual("../blockchain"),
    sendTransaction: jest.fn(async () => ({ hash: MOCK_ADDRESS })),
    waitForTransaction: jest.fn(async () => ({ status: 1 })),
    getBalance: jest.fn(async () => INITIAL_AMOUNT),
  };
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

describe("test index.ts", function () {
  let accounts: SignerWithAddress[];
  let provider: JsonRpcProvider;
  let dbInstance: DBInstance;
  let pgInstance: IMemoryDb;
  let requestService: RequestService;
  let accessTokenService: AccessTokenService;

  beforeAll(async function () {
    pgInstance = MockPgInstanceSingleton.getInstance();
    dbInstance = MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });
  beforeEach(async function () {
    MockPgInstanceSingleton.getInitialState().restore();
    accessTokenService = new AccessTokenService(dbInstance, "SECRET");
    requestService = new RequestService(dbInstance);
    accounts = await ethers.getSigners();
    provider = ethers.provider;
    requestService = new RequestService(dbInstance);
  });
  it("should handle fresh requests", async function () {
    const [owner] = accounts;
    const createRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    if (!createRequest) throw new Error("request was not created");
    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
    });
    const queryRequest = await requestService.getRequest(createRequest.id);
    assert.equal(queryRequest?.status, "SUCCESS");
  });
  it("should avoid requests that are not fresh", async function () {
    const [owner] = accounts;
    const createRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    if (!createRequest) throw new Error("request was not created");
    await requestService.updateRequest(createRequest.id, {
      status: "REJECTED-DURING-PROCESSING",
      accessTokenHash: createRequest.access_token_hash,
      nodeAddress: createRequest.node_address,
      chainId: createRequest.chain_id,
      amount: createRequest.amount,
      id: createRequest.id,
    });
    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
    });
    const queryRequest = await requestService.getRequest(createRequest.id);
    assert.equal(queryRequest?.status, "REJECTED-DURING-PROCESSING");
  });
  it("should fail if signer does not have enough to fund request", async function () {
    const [owner] = accounts;

    const createRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService,
      {
        amount: ethers.utils
          .parseEther(String(Number(MOCK_AMOUNT) + 1))
          .toString(),
        chainId: provider.network.chainId,
        nodeAddress: MOCK_ADDRESS,
      }
    );

    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
    });

    const queryRequest = await requestService.getRequest(createRequest.id);

    assert.equal(
      queryRequest?.reason,
      "Signer does not have enough balance to fund request"
    );
    assert.equal(queryRequest?.status, "REJECTED-DURING-PROCESSING");
  });
});
