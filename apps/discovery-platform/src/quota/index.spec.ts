import assert from "assert";
import * as db from "../db";
import { CreateQuota } from "./dto";
import {
  createQuota,
  deleteQuota,
  getQuota,
  getQuotasCreatedByClient,
  getQuotasPaidByClient,
  sumQuotas,
  updateQuota,
} from "./index";
import { MockPgInstanceSingleton } from "../db/index.spec";
import { createClient } from "../client";

const createMockQuota = (params?: CreateQuota): CreateQuota => {
  return {
    actionTaker: params?.actionTaker ?? "discovery-platform",
    clientId: params?.clientId ?? "client",
    quota: params?.quota ?? 1,
    paidBy: params?.paidBy ?? "client",
  };
};

describe("test quota functions", function () {
  let dbInstance: db.DBInstance;

  beforeAll(async function () {
    dbInstance = MockPgInstanceSingleton.getDbInstance();
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
  it("should get quotas created by client", async function () {
    // create client to create mocks with it
    await createClient(dbInstance, { id: "other client", payment: "premium" });
    const mockQuota = createMockQuota({
      clientId: "client",
      actionTaker: "discovery",
      quota: 10,
      paidBy: "client",
    });
    await createQuota(dbInstance, mockQuota);
    await createQuota(dbInstance, mockQuota);
    await createQuota(
      dbInstance,
      createMockQuota({
        actionTaker: "discovery",
        clientId: "other client",
        quota: 20,
        paidBy: "client",
      })
    );

    const quotas = await db.getQuotasCreatedByClient(dbInstance, "client");
    assert.equal(quotas.length, 2);
  });
  it("should update quota", async function () {
    const mockQuota = createMockQuota({
      clientId: "client",
      actionTaker: "discovery",
      quota: 10,
      paidBy: "client",
    });
    const createdQuota = await createQuota(dbInstance, mockQuota);
    await updateQuota(dbInstance, { ...createdQuota, action_taker: "eve" });
    const updatedQuota = await db.getQuota(dbInstance, createdQuota.id ?? 0);
    assert.equal(updatedQuota?.action_taker, "eve");
  });
  it("should delete quota", async function () {
    const mockQuota = createMockQuota({
      clientId: "client",
      actionTaker: "discovery",
      quota: 10,
      paidBy: "client",
    });
    const createdQuota = await createQuota(dbInstance, mockQuota);
    if (!createdQuota.id) throw new Error("Could not create mock quota");
    await deleteQuota(dbInstance, createdQuota.id);
    const deletedQuota = await getQuota(dbInstance, createdQuota.id ?? 0);
    assert.equal(deletedQuota, undefined);
  });

  it("should sum all quota paid by client", async function () {
    const baseQuota = 10;
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

    const allQuotasPaidByClient = await getQuotasPaidByClient(
      dbInstance,
      "sponsor"
    );

    const sum = sumQuotas(allQuotasPaidByClient);

    assert.equal(sum, 2 * baseQuota);
  });
  it("should sum all quota used by client", async function () {
    const baseQuota = 10;
    const mockQuota = createMockQuota({
      clientId: "client",
      actionTaker: "discovery",
      quota: baseQuota,
      paidBy: "sponsor",
    });

    // client uses quota twice
    await createQuota(dbInstance, mockQuota);
    await createQuota(dbInstance, mockQuota);

    // sponsor uses quota once
    await createQuota(dbInstance, { ...mockQuota, clientId: "sponsor" });

    const allQuotasCreatedByClient = await getQuotasCreatedByClient(
      dbInstance,
      "client"
    );

    const sum = sumQuotas(allQuotasCreatedByClient);

    assert.equal(sum, 2 * baseQuota);
  });
});
