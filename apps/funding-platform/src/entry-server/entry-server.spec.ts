import { Express } from "express";
import request from "supertest";
import { AccessTokenService } from "../access-token";
import { DBInstance } from "../db";
import { entryServer } from "./entry-server";

const SIXTY_MINUTES = 60;
const MAX_HOPR = 40;

describe("test entry server", function () {
  let dbInstance: DBInstance;
  let accessTokenService: AccessTokenService;
  let app: Express;

  beforeEach(function () {
    dbInstance = {
      data: { accessTokens: [], requests: [] },
    } as unknown as DBInstance;
    accessTokenService = new AccessTokenService(dbInstance);
    app = entryServer({
      accessTokenService,
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
      new Date(now).setMinutes(now.getMinutes() + SIXTY_MINUTES)
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
  it("should not requests without access tokens", async function () {
    return await request(app)
      .get("/api/request/status")
      .set("Accept", "application/json")
      .expect(400);
  });
  it("should not requests with invented access token", async function () {
    return await request(app)
      .get("/api/request/status")
      .set("Accept", "application/json")
      .set("x-access-token", "invented_token")
      .expect("Content-Type", /json/)
      .expect(404);
  });
});
