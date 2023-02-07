import { AccessTokenService } from "./access-token.service";
import assert from "assert";
import { DBInstance } from "../db";
import { MockPgInstanceSingleton } from "../db/index.spec";
import { IMemoryDb } from "pg-mem";

const THIRTY_MINUTES_IN_MS = 30 * 60_000;
const MAX_HOPR = 40;
const SECRET_KEY = "SECRET";
const accessTokenParams = {
  amount: MAX_HOPR,
  timeout: THIRTY_MINUTES_IN_MS,
};
describe("test AccessTokenService class", function () {
  let accessTokenService: AccessTokenService;
  let dbInstance: DBInstance;
  let pgInstance: IMemoryDb;

  beforeAll(async function () {
    pgInstance = MockPgInstanceSingleton.getInstance();
    dbInstance = MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(function () {
    MockPgInstanceSingleton.getInitialState().restore();
    accessTokenService = new AccessTokenService(dbInstance, SECRET_KEY);
  });

  it("should create and save token", async function () {
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    const dbAccessToken = await accessTokenService.getAccessToken(
      accessToken?.token!
    );
    assert(dbAccessToken?.token === accessToken?.token);
  });
  it("should create access token that expires in a specific amount of milliseconds", async function () {
    const expectedExpireDate = new Date(
      new Date().valueOf() + THIRTY_MINUTES_IN_MS
    );
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    const dbAccessToken = await accessTokenService.getAccessToken(
      accessToken?.token!
    );
    if (!dbAccessToken)
      throw new Error("Could not find access token in test db");

    expect(new Date(dbAccessToken.expired_at).valueOf()).toBeCloseTo(
      expectedExpireDate.valueOf(),
      100
    );
  });
  it("should get access token", async function () {
    await accessTokenService.createAccessToken(accessTokenParams);
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    const dbAccessToken = await accessTokenService.getAccessToken(
      accessToken?.token!
    );
    assert(dbAccessToken?.token === accessToken?.token);
  });
  it("should delete access token", async function () {
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    await accessTokenService.deleteAccessToken(accessToken?.token!);
    const dbAccessToken = await accessTokenService.getAccessToken(
      accessToken?.token!
    );
    assert(dbAccessToken === null);
  });
});
