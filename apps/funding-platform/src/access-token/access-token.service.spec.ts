import { AccessTokenService } from "./access-token.service";
import assert from "assert";
import { DBInstance } from "..";

describe("test AccessTokenService class", function () {
  let accessTokenService: AccessTokenService;
  beforeEach(function () {
    let db = {
      data: { accessTokens: [], requests: [] },
    } as unknown as DBInstance;
    accessTokenService = new AccessTokenService(db);
  });
  it("should create and save token", async function () {
    const res = await accessTokenService.createAccessToken();
    const dbAccessToken = await accessTokenService.getAccessToken(
      res.getHash()
    );
    assert(dbAccessToken?.Token === res.getHash());
  });
  it("should get access token", async function () {
    await accessTokenService.createAccessToken();
    const res2 = await accessTokenService.createAccessToken();
    const dbAccessToken2 = await accessTokenService.getAccessToken(
      res2.getHash()
    );
    assert(dbAccessToken2?.Token === res2.getHash());
  });
  it("should delete access token", async function () {
    const res = await accessTokenService.createAccessToken();
    await accessTokenService.deleteAccessToken(res.getHash());
    const dbAccessToken = await accessTokenService.getAccessToken(
      res.getHash()
    );
    assert(dbAccessToken === undefined);
  });
});
