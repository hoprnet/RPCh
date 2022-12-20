import { ethers } from "hardhat";
import assert from "assert";
import { DBInstance } from "../db";
import { checkFreshRequests } from ".";
import { RequestService } from "../request";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { IBackup, IMemoryDb } from "pg-mem";
import { AccessTokenService } from "../access-token";
import { mockPgInstance } from "../db/index.mock";
import * as erc20 from "../blockchain/erc20-fixture.json";
import { Contract } from "ethers";

const MOCK_ADDRESS = "0xA10AA7711FD1FA48ACAE6FF00FCB63B0F6AD055F";
const MOCK_AMOUNT = "100";
const MOCK_CHAIN_ID = 31337;
const MOCK_TIMEOUT = 3000;

const INITIAL_AMOUNT = ethers.utils.parseEther("1000").toString();
const TOKEN_NAME = "CUSTOM TOKEN";
const DECIMAL_UNITS = "18";
const TOKEN_SYMBOL = "TKN";

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
  let initialDbState: IBackup;
  let requestService: RequestService;
  let accessTokenService: AccessTokenService;
  let contract: Contract;

  beforeAll(async function () {
    pgInstance = await mockPgInstance();
    initialDbState = pgInstance.backup();
    dbInstance = pgInstance.adapters.createPgPromise();
  });
  beforeEach(async function () {
    initialDbState.restore();
    accessTokenService = new AccessTokenService(dbInstance, "SECRET");
    requestService = new RequestService(dbInstance);
    accounts = await ethers.getSigners();
    provider = ethers.provider;
    requestService = new RequestService(dbInstance);
    const contractFactory = new ethers.ContractFactory(
      erc20.abi,
      erc20.byteCode
    ).connect(accounts[0]);
    contract = await contractFactory.deploy(
      INITIAL_AMOUNT,
      TOKEN_NAME,
      DECIMAL_UNITS,
      TOKEN_SYMBOL
    );
    await contract.deployed();
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
    await setBalance(owner.address, 0);
    const createRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
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
  it("should fail if request does not have chain id", async function () {
    const [owner] = accounts;
    await setBalance(owner.address, 0);
    const createRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );
    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
    });
    const queryRequest = await requestService.getRequest(createRequest.id);
    assert.equal(queryRequest?.reason, "Request is missing chainId");
    assert.equal(queryRequest?.status, "REJECTED-DURING-PROCESSING");
  });
});
