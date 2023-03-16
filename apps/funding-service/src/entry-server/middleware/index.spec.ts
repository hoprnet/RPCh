import { AccessTokenService } from "../../access-token";
import { DBInstance } from "../../types";
import { MockPgInstanceSingleton } from "../../db/index.spec";
import { RequestService } from "../../request";
import { doesAccessTokenHaveEnoughBalance } from "./index";

const SECRET_KEY = "SECRET";
const MAX_AMOUNT_OF_TOKENS = BigInt(40);
const TIMEOUT = 30;

describe("should test entry server middleware functions", function () {
  let dbInstance: DBInstance;
  let accessTokenService: AccessTokenService;
  let requestService: RequestService;

  beforeAll(async function () {
    dbInstance = await MockPgInstanceSingleton.getDbInstance();
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

    requestService.createRequest({
      amount: MAX_AMOUNT_OF_TOKENS - BigInt(1),
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
