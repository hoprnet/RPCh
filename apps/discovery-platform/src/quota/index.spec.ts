import assert from "assert";
import * as db from "../db";
import { Quota } from "../types";
import {
  createQuota,
  deleteQuota,
  getQuota,
  getSumOfQuotasPaidByClient,
} from "./index";
import {
  TestingDatabaseInstance,
  getTestingConnectionString,
} from "@rpch/common/build/internal/db";
import path from "path";
import { createClient } from "../client";
import { errors } from "pg-promise";

const createMockQuota = (params?: Quota): Quota => {
  return {
    actionTaker: params?.actionTaker ?? "discovery-platform",
    clientId: params?.clientId ?? "client",
    quota: params?.quota ?? BigInt(1),
    paidBy: params?.paidBy ?? "client",
  };
};

describe("test quota functions", function () {
  let dbInstance: TestingDatabaseInstance;

  beforeAll(async function () {
    const migrationsDirectory = path.join(__dirname, "../../migrations");
    dbInstance = await TestingDatabaseInstance.create(
      getTestingConnectionString(),
      migrationsDirectory
    );
  });

  beforeEach(async function () {
    await dbInstance.reset();
    await createClient(dbInstance.db, { id: "client", payment: "premium" });
    await createClient(dbInstance.db, { id: "sponsor", payment: "premium" });
  });

  afterAll(async function () {
    await dbInstance.close();
  });

  it("should create quota", async function () {
    const mockQuota = createMockQuota();
    const quota = await createQuota(dbInstance.db, mockQuota);
    assert.equal(quota.quota, mockQuota.quota);
  });
  it("should get quota by id", async function () {
    const mockQuota = createMockQuota();
    const createdQuota = await createQuota(dbInstance.db, mockQuota);
    await createQuota(dbInstance.db, createMockQuota());
    const queryQuota = await db.getQuota(dbInstance.db, createdQuota.id ?? 0);
    assert.equal(queryQuota?.quota, createdQuota.quota);
    assert.equal(queryQuota?.client_id, createdQuota.client_id);
  });
  it("should delete quota", async function () {
    const mockQuota = createMockQuota({
      clientId: "client",
      actionTaker: "discovery",
      paidBy: "client",
      quota: BigInt(10),
    });
    const createdQuota = await createQuota(dbInstance.db, mockQuota);
    if (!createdQuota.id) throw new Error("Could not create mock quota");
    await deleteQuota(dbInstance.db, createdQuota.id);
    try {
      await getQuota(dbInstance.db, createdQuota.id ?? 0);
    } catch (e) {
      if (e instanceof errors.QueryResultError) {
        assert.equal(e.message, "No data returned from the query.");
      }
    }
  });

  it("should sum all quota paid by client", async function () {
    const baseQuota = BigInt(10);
    const mockQuota = createMockQuota({
      clientId: "client",
      actionTaker: "discovery",
      quota: baseQuota,
      paidBy: "sponsor",
    });

    // sponsor pays twice
    await createQuota(dbInstance.db, mockQuota);
    await createQuota(dbInstance.db, mockQuota);

    // client pays for quota once
    await createQuota(dbInstance.db, { ...mockQuota, paidBy: "client" });

    const allQuotasPaidByClient = await getSumOfQuotasPaidByClient(
      dbInstance.db,
      "sponsor"
    );

    assert.equal(allQuotasPaidByClient, BigInt(2) * baseQuota);
  });
});
