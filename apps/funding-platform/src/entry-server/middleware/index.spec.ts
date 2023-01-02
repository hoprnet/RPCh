import { IMemoryDb } from "pg-mem";
import { AccessTokenService } from "../../access-token";
import { DBInstance } from "../../db";
import { MockPgInstanceSingleton } from "../../db/index.spec";
import { RequestService } from "../../request";
import { doesAccessTokenHaveEnoughBalance } from "./index";

const SECRET_KEY = "SECRET";
const MAX_AMOUNT_OF_TOKENS = 40;
const TIMEOUT = 30;

describe("should test entry server middleware functions", function () {
  let dbInstance: DBInstance;
  let accessTokenService: AccessTokenService;
  let requestService: RequestService;
  let pgInstance: IMemoryDb;

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

  it("should not allow tokens that are requesting more than max amount of tokens", async function () {
    const accessTokenResponse = await accessTokenService.createAccessToken({
      amount: MAX_AMOUNT_OF_TOKENS,
      timeout: TIMEOUT,
    });

    if (!accessTokenResponse)
      throw new Error("Failed to create access token in middleware test");

    requestService.createRequest({
      amount: (MAX_AMOUNT_OF_TOKENS - 1).toString(),
      chainId: 80,
      accessTokenHash: accessTokenResponse.token,
      nodeAddress: "0x0",
    });

    const tokenHasBalanceRes = await doesAccessTokenHaveEnoughBalance({
      maxAmountOfTokens: MAX_AMOUNT_OF_TOKENS,
      requestService,
      token: accessTokenResponse.token,
      requestAmount: MAX_AMOUNT_OF_TOKENS,
    });
    expect(tokenHasBalanceRes).toEqual(false);
  });
});
