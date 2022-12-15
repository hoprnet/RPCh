import { Express } from "express";
import request from "supertest";
import { AccessTokenService } from "../access-token";
import { RequestService } from "../request";
import { DBInstance } from "../db";
import { entryServer, doesAccessTokenHaveEnoughBalance } from ".";

const SECRET_KEY = "SECRET";
const MAX_AMOUNT_OF_TOKENS = 40;
const TIMEOUT = 30;

describe("test entry server", function () {
  let dbInstance: DBInstance;
  let accessTokenService: AccessTokenService;
  let requestService: RequestService;
  let app: Express;

  beforeEach(function () {
    dbInstance = {
      data: { accessTokens: [], requests: [] },
    } as unknown as DBInstance;
    accessTokenService = new AccessTokenService(dbInstance, SECRET_KEY);
    requestService = new RequestService(dbInstance);
    app = entryServer({
      accessTokenService,
      requestService,
      walletAddress: "0x0000000000000000",
      maxAmountOfTokens: MAX_AMOUNT_OF_TOKENS,
      timeout: TIMEOUT,
    });
  });

  it("should return token", async function () {
    return await request(app)
      .get("/api/access-token")
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(200);
  });
  it("should accept valid tokens", async function () {
    const responseToken = await request(app)
      .get("/api/access-token")
      .set("Accept", "application/json");

    return request(app)
      .get("/api/request/status")
      .set("Accept", "application/json")
      .set("x-access-token", responseToken.body.accessToken)
      .expect("Content-Type", /json/)
      .expect(200);
  });
  it("should not accept expired tokens", async function () {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2020-02-19"));
    const responseToken = await request(app)
      .get("/api/access-token")
      .set("Accept", "application/json");
    const now = new Date(Date.now());
    const expiredAt = new Date(
      new Date(now).setMinutes(now.getMinutes() + 2 * TIMEOUT)
    );
    jest.setSystemTime(expiredAt);
    await request(app)
      .get("/api/request/status")
      .set("Accept", "application/json")
      .set("x-access-token", responseToken.body.accessToken)
      .expect("Content-Type", /json/)
      .expect(401);

    jest.useRealTimers();
  });
  it("should not accept requests without access tokens", async function () {
    return await request(app)
      .get("/api/request/status")
      .set("Accept", "application/json")
      .expect(400);
  });
  it("should not accept requests with invented access token", async function () {
    return await request(app)
      .get("/api/request/status")
      .set("Accept", "application/json")
      .set("x-access-token", "invented_token")
      .expect("Content-Type", /json/)
      .expect(404);
  });
  it("should not accept requests with token that has exceeded max amount of tokens", async function () {
    const responseToken = await request(app)
      .get("/api/access-token")
      .set("Accept", "application/json");

    await request(app)
      .post("/api/request/funds/0x0000000000000000")
      .send({ amount: MAX_AMOUNT_OF_TOKENS - 1, chainId: 80 })
      .set("Accept", "application/json")
      .set("x-access-token", responseToken.body.accessToken);

    await request(app)
      .post("/api/request/funds/0x0000000000000000")
      .send({ amount: MAX_AMOUNT_OF_TOKENS, chainId: 80 })
      .set("Accept", "application/json")
      .set("x-access-token", responseToken.body.accessToken)
      .expect("Content-Type", /json/)
      .expect(401);
  });
  it("should not allow tokens that are requesting more than max amount of tokens", async function () {
    const tokenHash = "hash";
    requestService.createRequest({
      amount: (MAX_AMOUNT_OF_TOKENS - 1).toString(),
      chainId: 80,
      accessTokenHash: tokenHash,
      address: "0x0",
    });
    const tokenHasBalanceRes = await doesAccessTokenHaveEnoughBalance({
      maxAmountOfTokens: MAX_AMOUNT_OF_TOKENS,
      requestService,
      token: tokenHash,
      requestAmount: MAX_AMOUNT_OF_TOKENS,
    });
    expect(tokenHasBalanceRes).toEqual(false);
  });
});
