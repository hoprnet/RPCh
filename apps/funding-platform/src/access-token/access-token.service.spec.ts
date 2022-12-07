import { AccessTokenService } from "./access-token.service";
import assert from "assert";
import { DBInstance } from "../db";

const THIRTY_MINUTES = 30;
const MAX_HOPR = 40;
const SECRET_KEY = "SECRET";
const accessTokenParams = {
  amount: MAX_HOPR,
  timeout: THIRTY_MINUTES,
};
describe("test AccessTokenService class", function () {
  let accessTokenService: AccessTokenService;
  beforeEach(function () {
    let db = {
      data: { accessTokens: [], requests: [] },
    } as unknown as DBInstance;
    accessTokenService = new AccessTokenService(db, SECRET_KEY);
  });
  it("should create and save token", async function () {
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    const dbAccessToken = await accessTokenService.getAccessToken(
      accessToken.getHash()!
    );
    assert(dbAccessToken?.Token === accessToken.getHash());
  });
  it("should get access token", async function () {
    await accessTokenService.createAccessToken(accessTokenParams);
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    const dbAccessToken = await accessTokenService.getAccessToken(
      accessToken.getHash()!
    );
    assert(dbAccessToken?.Token === accessToken.getHash());
  });
  it("should delete access token", async function () {
    const accessToken = await accessTokenService.createAccessToken(
      accessTokenParams
    );
    await accessTokenService.deleteAccessToken(accessToken.getHash()!);
    const dbAccessToken = await accessTokenService.getAccessToken(
      accessToken.getHash()!
    );
    assert(dbAccessToken === undefined);
  });
});
