import assert from "assert";
import * as db from "../db";
import { CreateClient } from "./dto";
import { createClient, updateClient, deleteClient, getClient } from "./index";
import { MockPgInstanceSingleton } from "../db/index.spec";

const createMockClient = (params?: CreateClient): CreateClient => {
  return {
    id: params?.id ?? "client",
    payment: params?.payment ?? "premium",
    labels: params?.labels ?? ["eth"],
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
  it("should update quota", async function () {
    const mockClient = createMockClient();
    const createdClient = await createClient(dbInstance, mockClient);
    await db.updateClient(dbInstance, {
      ...createdClient,
      labels: ["eth"],
    });
    const queryClient = await getClient(dbInstance, createdClient.id);
    assert.equal(queryClient?.id, mockClient.id);
    assert.deepEqual(queryClient?.labels, ["eth"]);
  });
  it("should delete quota", async function () {
    const mockClient = createMockClient({
      id: "client",
      payment: "premium",
      labels: [],
    });
    const createdClient = await createClient(dbInstance, mockClient);
    if (!createdClient.id) throw new Error("Could not create mock client");
    await db.deleteClient(dbInstance, createdClient.id);
    const deletedClient = await getClient(dbInstance, createdClient.id);
    assert.equal(deletedClient, undefined);
  });
  it.skip("should get sum of all quotas", async function () {});
});
