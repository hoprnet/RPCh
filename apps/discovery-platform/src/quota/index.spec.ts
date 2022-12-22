import assert from "assert";
import * as db from "../db";
import { CreateQuota } from "./dto";
import {
  createQuota,
  deleteQuota,
  getAllQuotasByClient,
  getQuota,
  updateQuota,
} from "./index";

const createMockQuota = (params?: CreateQuota): CreateQuota => {
  return {
    actionTaker: params?.actionTaker ?? "discovery-platform",
    client: params?.client ?? "client",
    quota: params?.quota ?? 1,
    createdAt: new Date().toISOString(),
  };
};

describe("test quota functions", function () {
  let dbInstance: db.DBInstance;
  beforeEach(function () {
    dbInstance = {
      data: {
        registeredNodes: [],
        quotas: [],
      },
    };
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
    assert.equal(queryQuota?.client, createdQuota.client);
  });
  it("should get quotas by client", async function () {
    const mockQuota = createMockQuota({
      client: "client",
      actionTaker: "discovery",
      quota: 10,
      createdAt: "now",
    });
    await createQuota(dbInstance, mockQuota);
    await createQuota(dbInstance, mockQuota);
    await createQuota(
      dbInstance,
      createMockQuota({
        actionTaker: "discovery",
        client: "other client",
        quota: 20,
        createdAt: "now",
      })
    );

    const quotas = await db.getAllQuotasByClient(dbInstance, "client");
    assert.equal(quotas.length, 2);
  });
  it("should update quota", async function () {
    const mockQuota = createMockQuota({
      client: "client",
      actionTaker: "discovery",
      quota: 10,
      createdAt: "now",
    });
    const createdQuota = await createQuota(dbInstance, mockQuota);
    await updateQuota(dbInstance, { ...createdQuota, action_taker: "eve" });
    const updatedQuota = await db.getQuota(dbInstance, createdQuota.id ?? 0);
    assert.equal(updatedQuota?.action_taker, "eve");
  });
  it("should delete quota", async function () {
    const mockQuota = createMockQuota({
      client: "client",
      actionTaker: "discovery",
      quota: 10,
      createdAt: "now",
    });
    const createdQuota = await createQuota(dbInstance, mockQuota);
    if (!createdQuota.id) throw new Error("Could not create mock quota");
    await db.deleteQuota(dbInstance, createdQuota.id);
    const deletedQuota = await db.getQuota(dbInstance, createdQuota.id ?? 0);
    assert.equal(deletedQuota, undefined);
  });
});
