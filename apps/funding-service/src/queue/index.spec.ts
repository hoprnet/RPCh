import { JsonRpcProvider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import assert from "assert";
import { ethers } from "hardhat";
import { checkFreshRequests } from ".";
import { AccessTokenService } from "../access-token";
import { RequestService } from "../request";
import Prometheus from "prom-client";
import {
  TestingDatabaseInstance,
  getTestingConnectionString,
} from "@rpch/common/build/internal/db";
import path from "path";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";

const MOCK_ADDRESS = "0xA10AA7711FD1FA48ACAE6FF00FCB63B0F6AD055F";
const MOCK_AMOUNT = "1000";
const MOCK_CHAIN_ID = 31337;
const MOCK_TIMEOUT = 3_000;

const INITIAL_AMOUNT = ethers.utils.parseEther(MOCK_AMOUNT).toBigInt();

jest.mock("@rpch/common", () => {
  return {
    ...jest.requireActual("@rpch/common"),
    blockchain: {
      sendTransaction: jest.fn(async () => ({ hash: MOCK_ADDRESS })),
      waitForTransaction: jest.fn(async () => ({ status: 1 })),
      getBalance: jest.fn(async () => INITIAL_AMOUNT),
    },
  };
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
    amount: BigInt(MOCK_AMOUNT),
    timeout: MOCK_TIMEOUT,
  });

  const queryRequest = await requestService.createRequest(
    params
      ? { ...params, accessTokenHash: queryToken.token }
      : {
          accessTokenHash: queryToken.token,
          amount: BigInt(MOCK_AMOUNT),
          chainId: MOCK_CHAIN_ID,
          nodeAddress: MOCK_ADDRESS,
        }
  );
  return queryRequest;
};

describe("test index.ts", function () {
  let accounts: SignerWithAddress[];
  let provider: JsonRpcProvider;
  let dbInstance: TestingDatabaseInstance;
  let requestService: RequestService;
  let accessTokenService: AccessTokenService;
  const register = new Prometheus.Registry();
  const metricManager = new MetricManager(Prometheus, register, "test");
  const counterSuccessfulFundingNodes = metricManager.createCounter(
    "counter_funded_nodes_successful",
    "amount of times we have funded nodes successfully"
  );
  const counterFailedFundingNodes = metricManager.createCounter(
    "counter_funded_nodes_failed",
    "amount of times we have failed to fund nodes"
  );

  beforeAll(async function () {
    const migrationsDirectory = path.join(__dirname, "../../migrations");
    dbInstance = await TestingDatabaseInstance.create(
      getTestingConnectionString(),
      migrationsDirectory
    );
  });

  beforeEach(async function () {
    await dbInstance.reset();
    accessTokenService = new AccessTokenService(dbInstance.db, "SECRET");
    requestService = new RequestService(dbInstance.db);
    accounts = await ethers.getSigners();
    provider = ethers.provider;
    await provider.getNetwork();
    requestService = new RequestService(dbInstance.db);
  });

  afterAll(async function () {
    await dbInstance.close();
  });

  it("should handle fresh requests", async function () {
    const [owner] = accounts;
    const createRequest = await createAccessTokenAndRequest(
      accessTokenService,
      requestService
    );

    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
      counterSuccessfulFundingNodes,
      counterFailedFundingNodes,
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
    await requestService.updateRequest(createRequest.id, {
      status: "REJECTED-DURING-PROCESSING",
      access_token_hash: createRequest.access_token_hash,
      node_address: createRequest.node_address,
      chain_id: createRequest.chain_id,
      amount: createRequest.amount,
      id: createRequest.id,
    });

    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
      counterSuccessfulFundingNodes,
      counterFailedFundingNodes,
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
        amount: BigInt(MOCK_AMOUNT) + BigInt("20000000000000000000000"),
        chainId: provider.network.chainId,
        nodeAddress: MOCK_ADDRESS,
      }
    );

    await checkFreshRequests({
      requestService,
      signer: owner,
      confirmations: 0,
      changeState: () => {},
      counterSuccessfulFundingNodes,
      counterFailedFundingNodes,
    });

    const queryRequest = await requestService.getRequest(createRequest.id);

    assert.equal(
      queryRequest?.reason,
      "Signer does not have enough balance to fund request"
    );
    assert.equal(queryRequest?.status, "REJECTED-DURING-PROCESSING");
  });
});
