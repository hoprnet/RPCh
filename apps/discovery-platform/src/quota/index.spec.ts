import assert from "assert";
import * as db from "../db";
import { Quota } from "../types";
import {
  createQuota,
  deleteQuota,
  getQuota,
  getSumOfQuotasUsedByClient,
  getSumOfQuotasPaidByClient,
} from "./index";
import { MockPgInstanceSingleton } from "@rpch/common/build/internal/db";
import path from "path";
import * as PgMem from "pg-mem";
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
  let dbInstance: db.DBInstance;

  beforeAll(async function () {
    const migrationsDirectory = path.join(__dirname, "../../migrations");
    dbInstance = await MockPgInstanceSingleton.getDbInstance(
      PgMem,
      migrationsDirectory
    );
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(async function () {
    MockPgInstanceSingleton.getInitialState().restore();
    await createClient(dbInstance, { id: "client", payment: "premium" });
    await createClient(dbInstance, { id: "sponsor", payment: "premium" });
  });

  it("should create quota", async function () {
    const mockQuota = createMockQuota();
    const quota = await createQuota(dbInstance, mockQuota);
    assert.equal(quota.quota, mockQuota.quota);
  });
  it("should get quota by id", async function () {
    const mockQuota = createMockQuota();
    const createdQuota = await createQuota(dbInstance, mockQuota);
    await createQuota(dbInstance, createMockQuota());
    const queryQuota = await db.getQuota(dbInstance, createdQuota.id ?? 0);
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
    const createdQuota = await createQuota(dbInstance, mockQuota);
    if (!createdQuota.id) throw new Error("Could not create mock quota");
    await deleteQuota(dbInstance, createdQuota.id);
    try {
      await getQuota(dbInstance, createdQuota.id ?? 0);
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
    await createQuota(dbInstance, mockQuota);
    await createQuota(dbInstance, mockQuota);

    // client pays for quota once
    await createQuota(dbInstance, { ...mockQuota, paidBy: "client" });

    const allQuotasPaidByClient = await getSumOfQuotasPaidByClient(
      dbInstance,
      "sponsor"
    );

    assert.equal(allQuotasPaidByClient, BigInt(2) * baseQuota);
  });
});
