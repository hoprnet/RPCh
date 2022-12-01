import * as db from "./db.adapter";
import assert from "assert";
import { DBInstance } from "..";
import { CreateAccessToken } from "../access-token";

describe("test db adapter functions", function () {
  let dbInstance: DBInstance;
  beforeEach(function () {
    dbInstance = {
      data: { accessTokens: [], requests: [] },
    } as unknown as DBInstance;
  });
  it("should save access token", async function () {
    const createAccessToken: CreateAccessToken = {
      Id: Math.floor(Math.random() * 1e6),
      CreatedAt: new Date().toISOString(),
      ExpiredAt: new Date().toISOString(),
      Token: "token",
    };
    await db.saveAccessToken(dbInstance, createAccessToken);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken.Token
    );
    assert(dbAccessToken?.Token, createAccessToken.Token);
  });
  it("should get access token", async function () {
    const createAccessToken1: CreateAccessToken = {
      Id: Math.floor(Math.random() * 1e6),
      CreatedAt: new Date().toISOString(),
      ExpiredAt: new Date().toISOString(),
      Token: "token",
    };
    const createAccessToken2: CreateAccessToken = {
      Id: Math.floor(Math.random() * 1e6),
      CreatedAt: new Date().toISOString(),
      ExpiredAt: new Date().toISOString(),
      Token: "token",
    };
    await db.saveAccessToken(dbInstance, createAccessToken1);
    await db.saveAccessToken(dbInstance, createAccessToken2);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken2.Token
    );
    assert(dbAccessToken?.Token, createAccessToken2.Token);
  });
  it("should delete access token", async function () {
    const createAccessToken: CreateAccessToken = {
      Id: Math.floor(Math.random() * 1e6),
      CreatedAt: new Date().toISOString(),
      ExpiredAt: new Date().toISOString(),
      Token: "token",
    };
    await db.saveAccessToken(dbInstance, createAccessToken);
    await db.deleteAccessToken(dbInstance, createAccessToken.Token);
    const dbAccessToken = await db.getAccessToken(
      dbInstance,
      createAccessToken.Token
    );
    assert(dbAccessToken === undefined);
  });
  it.todo("should save request");
  it.todo("should get request");
  it.todo("should delete request");
  it.todo("should update request");
});
