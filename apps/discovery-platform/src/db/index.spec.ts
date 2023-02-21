import assert from "assert";
import { QueryRegisteredNode } from "../registered-node/dto";
import * as db from "./";
import { CreateQuota } from "../quota/dto";
import { IBackup, IMemoryDb, newDb } from "pg-mem";
import { utils } from "@rpch/common";
import { CreateClient, QueryClient } from "../client/dto";
import path from "path";
import * as fixtures from "@rpch/common/build/fixtures";

export class MockPgInstanceSingleton {
  private static pgInstance: IMemoryDb;
  private static dbInstance: db.DBInstance;
  private static initialDbState: IBackup;

  private constructor() {}

  private async createInstance() {
    const migrationsDirectory = path.join(__dirname, "../../migrations");
    let instance = newDb();
    await instance.public.migrate({ migrationsPath: migrationsDirectory });
    fixtures.withQueryIntercept(instance);
    MockPgInstanceSingleton.pgInstance = instance;
    MockPgInstanceSingleton.initialDbState =
      MockPgInstanceSingleton.pgInstance.backup();
    return MockPgInstanceSingleton.pgInstance;
  }

  public static async getInstance(): Promise<IMemoryDb> {
    if (!MockPgInstanceSingleton.pgInstance) {
      await new this().createInstance();
    }
    return MockPgInstanceSingleton.pgInstance;
  }

  public static async getDbInstance(): Promise<db.DBInstance> {
    if (!MockPgInstanceSingleton.dbInstance) {
      const instance = await this.getInstance();
      MockPgInstanceSingleton.dbInstance = instance.adapters.createPgPromise();
    }
    return MockPgInstanceSingleton.dbInstance;
  }

  public static backup(): void {
    MockPgInstanceSingleton.initialDbState =
      MockPgInstanceSingleton.pgInstance.backup();
  }

  public static getInitialState(): IBackup {
    return MockPgInstanceSingleton.initialDbState;
  }
}

const createMockNode = (
  peerId?: string,
  hasExitNode?: boolean
): QueryRegisteredNode => ({
  chain_id: 100,
  id: peerId ?? "peerId" + utils.generatePseudoRandomId(1e6),
  has_exit_node: hasExitNode ?? true,
  hoprd_api_endpoint: "someendpoint:1337",
  native_address: "someaddress",
  exit_node_pub_key: "somepubkey",
  hoprd_api_token: "sometoken",
  honesty_score: 0,
  status: "FRESH",
  total_amount_funded: BigInt(0),
  created_at: Date.now().toString(),
  updated_at: Date.now().toString(),
});

const createMockQuota = (params?: CreateQuota): CreateQuota => {
  return {
    actionTaker: params?.actionTaker ?? "discovery-platform",
    clientId: params?.clientId ?? "client",
<<<<<<< HEAD
    quota: params?.quota ?? 1,
    paidBy: params?.paidBy ?? "client",
=======
    quota: params?.quota ?? BigInt(1),
>>>>>>> origin
  };
};

const createMockClient = (params?: CreateClient): CreateClient => {
  return {
    id: params?.id ?? "client",
    payment: params?.payment ?? "premium",
    labels: params?.labels ?? [],
  };
};

describe("test db functions", function () {
  let dbInstance: db.DBInstance;

  beforeAll(async function () {
    dbInstance = await MockPgInstanceSingleton.getDbInstance();
    MockPgInstanceSingleton.getInitialState();
  });

  beforeEach(async function () {
    MockPgInstanceSingleton.getInitialState().restore();
  });

  describe("registered node table", function () {
    it("should save registered node", async function () {
      const node = createMockNode();
      const savedNode = await db.saveRegisteredNode(dbInstance, node);
      if (!savedNode) throw new Error("Db could not save node");
      const dbNode = await db.getRegisteredNode(dbInstance, node.id);
      assert.equal(dbNode?.id, node.id);
    });
    it("should get all registered nodes", async function () {
      await db.saveRegisteredNode(dbInstance, createMockNode("1"));
      await db.saveRegisteredNode(dbInstance, createMockNode("2"));
      const allNodes = await db.getRegisteredNodes(dbInstance);

      assert.equal(allNodes.length, 2);
    });
    it("should get all nodes that are not exit nodes", async function () {
      const firstNode = createMockNode("peer1", false);
      await db.saveRegisteredNode(dbInstance, firstNode);
      const secondNode = createMockNode("peer2", false);
      await db.saveRegisteredNode(dbInstance, secondNode);
      await db.saveRegisteredNode(dbInstance, createMockNode());

      const notExitNodes = await db.getRegisteredNodes(dbInstance, {
        hasExitNode: false,
      });

      assert.equal(notExitNodes.length, 2);
    });
    it("should get all nodes that are not exit nodes", async function () {
      const firstNode = createMockNode("peer1", true);
      await db.saveRegisteredNode(dbInstance, firstNode);
      const secondNode = createMockNode("peer2", true);
      await db.saveRegisteredNode(dbInstance, secondNode);
      await db.saveRegisteredNode(dbInstance, createMockNode("peer2", false));

      const exitNodes = await db.getRegisteredNodes(dbInstance, {
        hasExitNode: true,
      });

      assert.equal(exitNodes.length, 2);
    });
    it("should get one registered node", async function () {
      await db.saveRegisteredNode(dbInstance, createMockNode("1"));
      await db.saveRegisteredNode(dbInstance, createMockNode("2"));
      const node = await db.getRegisteredNode(dbInstance, "1");

      assert.equal(node?.id, "1");
    });
    it("should get all registered nodes except the ones in exclude list", async function () {
      await db.saveRegisteredNode(dbInstance, createMockNode("1"));
      await db.saveRegisteredNode(dbInstance, createMockNode("2"));
      await db.saveRegisteredNode(dbInstance, createMockNode("3"));
      const notExcludedNodes = await db.getRegisteredNodes(dbInstance, {
        excludeList: ["2"],
      });
      assert.equal(notExcludedNodes.length, 2);
      assert.equal(
        notExcludedNodes.findIndex((node) => node.id === "2"),
        -1
      );
    });
    it("should update node", async function () {
      await db.saveRegisteredNode(dbInstance, createMockNode("peer1"));
      const node = await db.getRegisteredNode(dbInstance, "peer1");
      if (!node) throw new Error("Db could not save node");

      await db.updateRegisteredNode(dbInstance, {
        ...node,
        status: "UNUSABLE",
      });
      const updatedNode = await db.getRegisteredNode(dbInstance, "peer1");

      assert.equal(updatedNode?.status, "UNUSABLE");
    });
  });
  describe("client table", function () {
    it("should create client", async function () {
      const mockClient = createMockClient();
      const client = await db.createClient(dbInstance, mockClient);
      assert.equal(client.id, mockClient.id);
    });
    it("should get client", async function () {
      const mockClient = createMockClient();
      const createdClient = await db.createClient(dbInstance, mockClient);
      await db.createClient(
        dbInstance,
        createMockClient({
          id: "random-client",
          payment: "premium",
          labels: [],
        })
      );
      const queryClient = await db.getClient(dbInstance, createdClient.id);
      assert.equal(queryClient?.id, mockClient.id);
      assert.equal(queryClient?.payment, mockClient.payment);
    });
    it("should update client", async function () {
      const mockClient = createMockClient();
      const createdClient = await db.createClient(dbInstance, mockClient);
      await db.updateClient(dbInstance, {
        ...createdClient,
        labels: ["eth"],
      });
      const queryClient = await db.getClient(dbInstance, createdClient.id);
      assert.equal(queryClient?.id, mockClient.id);
      assert.deepEqual(queryClient?.labels, ["eth"]);
    });
    it("should delete client", async function () {
      const mockClient = createMockClient({
        id: "client",
        payment: "premium",
        labels: [],
      });
      const createdClient = await db.createClient(dbInstance, mockClient);
      if (!createdClient.id) throw new Error("Could not create mock client");
      await db.deleteClient(dbInstance, createdClient.id);
      const deletedClient = await db.getClient(dbInstance, createdClient.id);
      assert.equal(deletedClient, undefined);
    });
  });
  describe("quota table", function () {
    let client: QueryClient;
    beforeEach(async function () {
      const mockClient = createMockClient();
      client = await db.createClient(dbInstance, mockClient);
    });
    it("should create quota", async function () {
      const mockQuota = createMockQuota();
      const quota = await db.createQuota(dbInstance, mockQuota);
      assert.equal(quota.quota, mockQuota.quota);
    });
    it("should get quota by id", async function () {
      const mockQuota = createMockQuota();
      const createdQuota = await db.createQuota(dbInstance, mockQuota);
      await db.createQuota(dbInstance, createMockQuota());
      const queryQuota = await db.getQuota(dbInstance, createdQuota.id ?? 0);
      assert.equal(queryQuota?.quota, mockQuota.quota);
      assert.equal(queryQuota?.action_taker, mockQuota.actionTaker);
    });
    it("should get quotas created by client", async function () {
      // create client
      const mockClient = createMockClient({
        id: "other client",
        payment: "premium",
      });
      const otherClient = await db.createClient(dbInstance, mockClient);
      // create quota for client but paid by other client
      const mockQuota = createMockQuota({
        clientId: "client",
        actionTaker: "discovery",
<<<<<<< HEAD
        quota: 10,
        paidBy: "other client",
=======
        quota: BigInt(10),
>>>>>>> origin
      });
      await db.createQuota(dbInstance, mockQuota);
      await db.createQuota(dbInstance, mockQuota);
      await db.createQuota(
        dbInstance,
        createMockQuota({
          actionTaker: "discovery",
          clientId: otherClient.id,
<<<<<<< HEAD
          quota: 20,
          paidBy: "other client",
=======
          quota: BigInt(20),
>>>>>>> origin
        })
      );

      const quotas = await db.getQuotasCreatedByClient(dbInstance, "client");
      assert.equal(quotas.length, 2);
    });
    it("should get quotas paid by client", async function () {
      // create client
      const mockClient = createMockClient({
        id: "other client",
        payment: "premium",
      });
      const otherClient = await db.createClient(dbInstance, mockClient);
      // create quotas that are used by 'client' and paid by 'other client'
      const mockQuota = createMockQuota({
        clientId: "client",
        actionTaker: "discovery",
        quota: 10,
        paidBy: "other client",
      });
      await db.createQuota(dbInstance, mockQuota);
      await db.createQuota(dbInstance, mockQuota);
      await db.createQuota(
        dbInstance,
        createMockQuota({
          actionTaker: "discovery",
          clientId: otherClient.id,
          quota: 20,
          paidBy: "other client",
        })
      );

      const quotas = await db.getQuotasPaidByClient(dbInstance, "other client");
      assert.equal(quotas.length, 3);
    });
    it("should update quota", async function () {
      const mockQuota = createMockQuota({
        clientId: "client",
        actionTaker: "discovery",
<<<<<<< HEAD
        quota: 10,
        paidBy: "client",
=======
        quota: BigInt(10),
>>>>>>> origin
      });
      const createdQuota = await db.createQuota(dbInstance, mockQuota);

      await db.updateQuota(dbInstance, {
        ...createdQuota,
        action_taker: "eve",
      });
      const updatedQuota = await db.getQuota(dbInstance, createdQuota.id ?? 0);
      assert.equal(updatedQuota?.action_taker, "eve");
    });
    it("should get only fresh nodes", async function () {
      await db.saveRegisteredNode(dbInstance, createMockNode("peer1"));
      const node = await db.getRegisteredNode(dbInstance, "peer1");
      if (!node) throw new Error("Db could not save node");
      await db.updateRegisteredNode(dbInstance, {
        ...node,
        status: "UNUSABLE",
      });
      await db.saveRegisteredNode(dbInstance, createMockNode("peer2"));
      await db.saveRegisteredNode(dbInstance, createMockNode("peer3"));

      const freshNodes = await db.getRegisteredNodes(dbInstance, {
        status: "FRESH",
      });
      const unusableNodes = await db.getRegisteredNodes(dbInstance, {
        status: "UNUSABLE",
      });

      assert.equal(freshNodes?.length, 2);
      assert.equal(unusableNodes?.length, 1);
    });
    it("should delete quota", async function () {
      const mockQuota = createMockQuota({
        clientId: "client",
        actionTaker: "discovery",
<<<<<<< HEAD
        quota: 10,
        paidBy: "client",
=======
        quota: BigInt(10),
>>>>>>> origin
      });
      const createdQuota = await db.createQuota(dbInstance, mockQuota);
      if (!createdQuota.id) throw new Error("Could not create mock quota");
      await db.deleteQuota(dbInstance, createdQuota.id);
      const deletedQuota = await db.getQuota(dbInstance, createdQuota.id ?? 0);
      assert.equal(deletedQuota, undefined);
    });
    it("should save funding request", async function () {
      await db.saveRegisteredNode(dbInstance, createMockNode("peer1"));
      const node = await db.getRegisteredNode(dbInstance, "peer1");
      if (!node) throw new Error("Db could not save node");

      const createdFundedRequest = await db.createFundingRequest(dbInstance, {
        registered_node_id: node.id,
        request_id: Math.floor(Math.random() * 1e6),
        amount: BigInt("1"),
      });

      assert.equal(createdFundedRequest.registered_node_id, node.id);
    });
  });
});
