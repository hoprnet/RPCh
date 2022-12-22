import { assert } from "chai";
import { Express } from "express";
import { IBackup, IMemoryDb } from "pg-mem";
import request from "supertest";
import { doesAccessTokenHaveEnoughBalance, entryServer } from ".";
import { AccessTokenService } from "../access-token";
import { DBInstance } from "../db";
import { mockPgInstance } from "../db/index.spec";
import { RequestService } from "../request";

const SECRET_KEY = "SECRET";
const MAX_AMOUNT_OF_TOKENS = 40;
const TIMEOUT = 30;

describe("test entry server", function () {
  let dbInstance: DBInstance;
  let accessTokenService: AccessTokenService;
  let requestService: RequestService;
  let app: Express | undefined;
  let agent: request.SuperTest<request.Test>;
  let pgInstance: IMemoryDb;
  let initialDbState: IBackup;

  beforeAll(async function () {
    pgInstance = await mockPgInstance();
    initialDbState = pgInstance.backup();
    dbInstance = pgInstance.adapters.createPgPromise();
  });

  beforeEach(function () {
    initialDbState.restore();
    accessTokenService = new AccessTokenService(dbInstance, SECRET_KEY);
    requestService = new RequestService(dbInstance);
    app = entryServer({
      accessTokenService,
      requestService,
      walletAddress: "0x0000000000000000",
      maxAmountOfTokens: MAX_AMOUNT_OF_TOKENS,
      timeout: TIMEOUT,
    });
    agent = request(app);
  });

  it("should return token", async function () {
    return await agent
      .get("/api/access-token")
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(200);
  });
  it("should accept valid tokens", async function () {
    const responseToken = await agent
      .get("/api/access-token")
      .set("Accept", "application/json");
    return agent
      .get("/api/request/status")
      .set("Accept", "application/json")
      .set("x-access-token", responseToken.body.accessToken)
      .expect("Content-Type", /json/)
      .expect(200);
  });
  it("should not accept expired tokens", async function () {
    let spy = jest
      .spyOn(AccessTokenService.prototype, "getAccessToken")
      .mockImplementation(
        async (token) => ({ token, expired_at: new Date("2020-10-10") } as any)
      );

    const responseToken = await agent
      .get("/api/access-token")
      .set("Accept", "application/json");

    await agent
      .get("/api/request/status")
      .set("Accept", "application/json")
      .set("x-access-token", responseToken.body.accessToken)
      .expect("Content-Type", /json/)
      .expect(401);

    spy.mockRestore();
  });
  it("should not accept requests without access tokens", async function () {
    return await agent
      .get("/api/request/status")
      .set("Accept", "application/json")
      .expect(400);
  });
  it("should not accept requests with invented access token", async function () {
    return await agent
      .get("/api/request/status")
      .set("Accept", "application/json")
      .set("x-access-token", "invented_token")
      .expect("Content-Type", /json/)
      .expect(404);
  });
  it("should not accept requests with token that has exceeded max amount of tokens", async function () {
    const responseToken = await agent
      .get("/api/access-token")
      .set("Accept", "application/json");

    await agent
      .post("/api/request/funds/0x0000000000000000")
      .send({ amount: MAX_AMOUNT_OF_TOKENS - 1, chainId: 80 })
      .set("Accept", "application/json")
      .set("x-access-token", responseToken.body.accessToken);

    await agent
      .post("/api/request/funds/0x0000000000000000")
      .send({ amount: MAX_AMOUNT_OF_TOKENS, chainId: 80 })
      .set("Accept", "application/json")
      .set("x-access-token", responseToken.body.accessToken)
      .expect("Content-Type", /json/)
      .expect(401);
  });
  it("should not allow tokens that are requesting more than max amount of tokens", async function () {
    const responseToken = await agent
      .get("/api/access-token")
      .set("Accept", "application/json");

    requestService.createRequest({
      amount: (MAX_AMOUNT_OF_TOKENS - 1).toString(),
      chainId: 80,
      accessTokenHash: responseToken.body.accessToken,
      nodeAddress: "0x0",
    });

    const tokenHasBalanceRes = await doesAccessTokenHaveEnoughBalance({
      maxAmountOfTokens: MAX_AMOUNT_OF_TOKENS,
      requestService,
      token: responseToken.body.accessToken,
      requestAmount: MAX_AMOUNT_OF_TOKENS,
    });
    expect(tokenHasBalanceRes).toEqual(false);
  });
  it("should return correct amount left", async function () {
    const responseToken = await agent
      .get("/api/access-token")
      .set("Accept", "application/json");

    const resFunding = await agent
      .post("/api/request/funds/0x0000000000000000")
      .send({ amount: MAX_AMOUNT_OF_TOKENS - 10, chainId: 80 })
      .set("Accept", "application/json")
      .set("x-access-token", responseToken.body.accessToken);

    assert.equal(resFunding.body.amountLeft, 10);
  });
});
