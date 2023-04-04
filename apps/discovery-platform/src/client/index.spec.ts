import assert from "assert";
import * as db from "../db";
import { Client } from "../types";
import { createClient, deleteClient, getClient, updateClient } from "./index";
import { errors } from "pg-promise";
import { MockPgInstanceSingleton } from "@rpch/common/build/internal/db";
import path from "path";
import * as PgMem from "pg-mem";

const createMockClient = (params?: Client): Client => {
  return {
    id: params?.id ?? "client",
    payment: params?.payment ?? "premium",
    labels: params?.labels ?? ["eth"],
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
  });

  it("should create client", async function () {
    const mockClient = createMockClient();
    const client = await createClient(dbInstance, mockClient);
    assert.equal(client.id, mockClient.id);
  });
  it("should get client by id", async function () {
    const mockClient = createMockClient();
    const createdClient = await createClient(dbInstance, mockClient);

    await createClient(
      dbInstance,
      createMockClient({
        id: "other client",
        payment: "premium",
        labels: [],
      })
    );

    const queryClient = await getClient(dbInstance, createdClient.id);

    assert.equal(queryClient?.id, createdClient.id);
    assert.equal(queryClient?.payment, createdClient.payment);
  });
  it("should update client", async function () {
    const mockClient = createMockClient();
    const createdClient = await createClient(dbInstance, mockClient);

    await updateClient(dbInstance, {
      ...createdClient,
      labels: ["eth"],
    });

    const queryClient = await getClient(dbInstance, createdClient.id);

    assert.equal(queryClient?.id, mockClient.id);
    assert.deepEqual(queryClient?.labels, ["eth"]);
  });
  it("should delete client", async function () {
    const mockClient = createMockClient({
      id: "client",
      payment: "premium",
      labels: [],
    });

    const createdClient = await createClient(dbInstance, mockClient);

    await deleteClient(dbInstance, createdClient.id);

    try {
      await getClient(dbInstance, createdClient.id);
    } catch (e) {
      if (e instanceof errors.QueryResultError) {
        assert.equal(e.message, "No data returned from the query.");
      }
    }
  });
});
