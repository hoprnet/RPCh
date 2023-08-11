import assert from "assert";
import { Client } from "../types";
import { createClient, deleteClient, getClient, updateClient } from "./index";
import { errors } from "pg-promise";
import {
  TestingDatabaseInstance,
  getTestingConnectionString,
} from "@rpch/common/build/internal/db";
import path from "path";

const createMockClient = (params?: Client): Client => {
  return {
    id: params?.id ?? "client",
    payment: params?.payment ?? "premium",
    labels: params?.labels ?? ["eth"],
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
  });

  afterAll(async function () {
    await dbInstance.close();
  });

  it("should create client", async function () {
    const mockClient = createMockClient();
    const client = await createClient(dbInstance.db, mockClient);
    assert.equal(client.id, mockClient.id);
  });
  it("should get client by id", async function () {
    const mockClient = createMockClient();
    const createdClient = await createClient(dbInstance.db, mockClient);

    await createClient(
      dbInstance.db,
      createMockClient({
        id: "other client",
        payment: "premium",
        labels: [],
      })
    );

    const queryClient = await getClient(dbInstance.db, createdClient.id);

    assert.equal(queryClient?.id, createdClient.id);
    assert.equal(queryClient?.payment, createdClient.payment);
  });
  it("should update client", async function () {
    const mockClient = createMockClient();
    const createdClient = await createClient(dbInstance.db, mockClient);

    await updateClient(dbInstance.db, {
      ...createdClient,
      labels: ["eth"],
    });

    const queryClient = await getClient(dbInstance.db, createdClient.id);

    assert.equal(queryClient?.id, mockClient.id);
    assert.deepEqual(queryClient?.labels, ["eth"]);
  });
  it("should delete client", async function () {
    const mockClient = createMockClient({
      id: "client",
      payment: "premium",
      labels: [],
    });

    const createdClient = await createClient(dbInstance.db, mockClient);

    await deleteClient(dbInstance.db, createdClient.id);

    try {
      await getClient(dbInstance.db, createdClient.id);
    } catch (e) {
      if (e instanceof errors.QueryResultError) {
        assert.equal(e.message, "No data returned from the query.");
      }
    }
  });
});
