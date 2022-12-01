import { Express } from "express";
import request from "supertest";
import { AccessTokenService } from "../access-token";
import { DBInstance } from "../index";
import { entryServer } from "./entry-server";

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
      accessTokenService: accessTokenService,
      db: dbInstance,
    });
  });
  it("should return token", function () {
    request(app)
      .get("/api/access-token")
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .expect(200);
  });
});
