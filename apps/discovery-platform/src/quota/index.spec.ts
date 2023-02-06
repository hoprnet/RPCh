import assert from "assert";
import * as db from "../db";
import { CreateQuota } from "./dto";
import {
  createQuota,
  getAllQuotasByClient,
  sumQuotas,
  updateQuota,
} from "./index";
import { MockPgInstanceSingleton } from "../db/index.spec";

const createMockQuota = (params?: CreateQuota): CreateQuota => {
  return {
    actionTaker: params?.actionTaker ?? "discovery-platform",
    clientId: params?.clientId ?? "client",
    quota: params?.quota ?? 1,
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
  it("should get quotas by client", async function () {
    const mockQuota = createMockQuota({
      clientId: "client",
      actionTaker: "discovery",
      quota: 10,
    });
    await createQuota(dbInstance, mockQuota);
    await createQuota(dbInstance, mockQuota);
    await createQuota(
      dbInstance,
      createMockQuota({
        actionTaker: "discovery",
        clientId: "other client",
        quota: 20,
      })
    );

    const quotas = await db.getQuotasByClient(dbInstance, "client");
    assert.equal(quotas.length, 2);
  });
  it("should update quota", async function () {
    const mockQuota = createMockQuota({
      clientId: "client",
      actionTaker: "discovery",
      quota: 10,
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
    });
    const createdQuota = await createQuota(dbInstance, mockQuota);
    if (!createdQuota.id) throw new Error("Could not create mock quota");
    await db.deleteQuota(dbInstance, createdQuota.id);
    const deletedQuota = await db.getQuota(dbInstance, createdQuota.id ?? 0);
    assert.equal(deletedQuota, undefined);
  });
  it("should sum all quotas", async function () {
    const baseQuota = 10;
    const mockQuota = createMockQuota({
      clientId: "client",
      actionTaker: "discovery",
      quota: baseQuota,
    });
    await createQuota(dbInstance, mockQuota);
    await createQuota(dbInstance, mockQuota);

    const allQuotasFromClient = await getAllQuotasByClient(
      dbInstance,
      "client"
    );
    const sum = sumQuotas(allQuotasFromClient);

    assert.equal(sum, 2 * baseQuota);
  });
});
