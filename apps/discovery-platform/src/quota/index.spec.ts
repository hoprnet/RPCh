import assert from "assert";
import * as db from "../db";
import { DBInstance, Quota } from "../types";
import {
  createQuota,
  deleteQuota,
  getQuota,
  getSumOfQuotasUsedByClient,
  getSumOfQuotasPaidByClient,
  updateQuota,
} from "./index";
import { MockPgInstanceSingleton } from "../db/index.spec";
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
  let dbInstance: DBInstance;

  beforeAll(async function () {
    dbInstance = await MockPgInstanceSingleton.getDbInstance();
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
    const queryQuota = await getQuota(dbInstance, createdQuota.id ?? 0);
    assert.equal(queryQuota?.quota, createdQuota.quota);
    assert.equal(queryQuota?.client_id, createdQuota.client_id);
  });
  it("should get quota by token", async function () {
    const mockQuota = createMockQuota();
    const token = "FAKE_TOKEN";
    const createdQuota = await createQuota(dbInstance, { ...mockQuota, token });
    await createQuota(dbInstance, createMockQuota());
    const queryQuota = await db.getQuotaByToken(dbInstance, token);
    assert.equal(queryQuota.token, token);
  });
  it("should get quotas created by client", async function () {
    const expectedQuotas = [
      BigInt("100000000"),
      BigInt("-10000"),
      BigInt("-1"),
    ];
    // create quotas that are used by 'client'
    const mockQuotas = expectedQuotas.map((quota) =>
      createMockQuota({
        clientId: "client",
        actionTaker: "discovery",
        quota,
        paidBy: "sponsor",
      })
    );

    await Promise.all(
      mockQuotas.map((mockQuota) => createQuota(dbInstance, mockQuota))
    );

    // create random quota that should not be taken into account
    await db.createQuota(
      dbInstance,
      createMockQuota({
        clientId: "sponsor",
        actionTaker: "discovery",
        quota: BigInt("10"),
        paidBy: "client",
      })
    );

    const sumOfQuotas = await getSumOfQuotasUsedByClient(dbInstance, "client");

    assert.equal(
      expectedQuotas.reduce((prev, next) => prev + next, BigInt(0)),
      sumOfQuotas
    );
  });
  it("should update quota", async function () {
    const mockQuota = createMockQuota({
      clientId: "client",
      actionTaker: "discovery",
      paidBy: "client",
      quota: BigInt(10),
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
  it("should sum all quota used by client", async function () {
    const baseQuota = BigInt(10);
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

    const allQuotasCreatedByClient = await db.getSumOfQuotasUsedByClient(
      dbInstance,
      "client"
    );

    assert.equal(allQuotasCreatedByClient, BigInt(2) * baseQuota);
  });
});
