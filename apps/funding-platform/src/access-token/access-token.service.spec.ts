import { AccessTokenService } from "./access-token.service";
import assert from "assert";
import { DBInstance } from "../db";
import { mockPgInstance } from "../db/index.spec";
import { IBackup, IMemoryDb } from "pg-mem";

const THIRTY_MINUTES = 30;
const MAX_HOPR = 40;
const SECRET_KEY = "SECRET";
const accessTokenParams = {
  amount: MAX_HOPR,
  timeout: THIRTY_MINUTES,
};
describe("test AccessTokenService class", function () {
  let accessTokenService: AccessTokenService;
  let dbInstance: DBInstance;
  let pgInstance: IMemoryDb;
  let initialDbState: IBackup;
  beforeAll(async function () {
    pgInstance = await mockPgInstance();
    initialDbState = pgInstance.backup();
    dbInstance = pgInstance.adapters.createPgPromise();
  });
  beforeEach(function () {
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
