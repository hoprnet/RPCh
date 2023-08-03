import assert from "assert";
import * as db from "./";
import { utils } from "@rpch/common";
import * as PgMem from "pg-mem";
import { Client, ClientDB, Quota, RegisteredNodeDB } from "../types";
import { errors } from "pg-promise";
import path from "path";
import { MockPgInstanceSingleton } from "@rpch/common/build/internal/db";

const createMockNode = (
  peerId?: string,
  hasExitNode?: boolean
): RegisteredNodeDB => ({
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

const createMockQuota = (params?: Quota): Quota => {
  return {
    actionTaker: params?.actionTaker ?? "discovery-platform",
    clientId: params?.clientId ?? "client",
    paidBy: params?.paidBy ?? "client",
    quota: params?.quota ?? BigInt(1),
  };
};

const createMockClient = (params?: Client): Client => {
  return {
    id: params?.id ?? "client",
    payment: params?.payment ?? "premium",
    labels: params?.labels ?? [],
  };
};

describe("test db functions", function () {
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

  describe("registered node table", function () {
    it("should save registered node", async function () {
      const node = createMockNode();
      await db.saveRegisteredNode(dbInstance, node);
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

      await db.updateRegisteredNode(dbInstance, {
        ...node,
        status: "UNUSABLE",
      });
      const updatedNode = await db.getRegisteredNode(dbInstance, "peer1");

      assert.equal(updatedNode?.status, "UNUSABLE");
    });
    it("should delete registered node", async function () {
      const registeredNodeId = "peer1";
      await db.saveRegisteredNode(dbInstance, createMockNode(registeredNodeId));
      const node = await db.getRegisteredNode(dbInstance, registeredNodeId);
      assert.equal(node.id, registeredNodeId);
      await db.deleteRegisteredNode(dbInstance, registeredNodeId);
      await expect(
        db.getRegisteredNode(dbInstance, registeredNodeId)
      ).rejects.toThrowError();
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
      await db.deleteClient(dbInstance, createdClient.id);

      try {
        await db.getClient(dbInstance, createdClient.id);
      } catch (e) {
        if (e instanceof errors.QueryResultError) {
          assert.equal(e.message, "No data returned from the query.");
        }
      }
    });
  });
  describe("quota table", function () {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let client: ClientDB;
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
    it("should get sum of quotas used by client", async function () {
      const expectedQuotas = [
        BigInt("100000000"),
        BigInt("-10000"),
        BigInt("-1"),
      ];
      // create client to pay quotas
      const mockClient = createMockClient({
        id: "other client",
        payment: "premium",
      });
      await db.createClient(dbInstance, mockClient);
      // create quotas that are used by 'client'
      const mockQuotas = expectedQuotas.map((quota) =>
        createMockQuota({
          clientId: "client",
          actionTaker: "discovery",
          quota,
          paidBy: "other client",
        })
      );

      await Promise.all(
        mockQuotas.map((mockQuota) => db.createQuota(dbInstance, mockQuota))
      );

      // create random quota that should not be taken into account
      await db.createQuota(
        dbInstance,
        createMockQuota({
          clientId: "other client",
          actionTaker: "discovery",
          quota: BigInt("10"),
          paidBy: "client",
        })
      );

      const { sum: sumOfQuotas } = await db.getClientQuotas(
        dbInstance,
        "client"
      );

      assert.equal(
        expectedQuotas.reduce((prev, next) => prev + next, BigInt(0)),
        sumOfQuotas
      );
    });

    it("should get sum of quotas paid by client", async function () {
      const expectedQuotas = [
        BigInt("100000000"),
        BigInt("-10000"),
        BigInt("-1"),
      ];
      // create client
      const mockClient = createMockClient({
        id: "other client",
        payment: "premium",
      });
      await db.createClient(dbInstance, mockClient);
      // create quotas that are paid by 'other client'
      const mockQuotas = expectedQuotas.map((quota) =>
        createMockQuota({
          clientId: "client",
          actionTaker: "discovery",
          quota,
          paidBy: "other client",
        })
      );

      await Promise.all(
        mockQuotas.map((mockQuota) => db.createQuota(dbInstance, mockQuota))
      );

      // create random quota that should not be taken into account
      await db.createQuota(
        dbInstance,
        createMockQuota({
          clientId: "other client",
          actionTaker: "discovery",
          quota: BigInt("10"),
          paidBy: "client",
        })
      );

      const { sum: sumOfQuotas } = await db.getClientQuotas(
        dbInstance,
        "other client"
      );

      assert.equal(
        expectedQuotas.reduce((prev, next) => prev + next, BigInt(0)),
        sumOfQuotas
      );
    });
    it("should get only fresh nodes", async function () {
      await db.saveRegisteredNode(dbInstance, createMockNode("peer1"));

      const node = await db.getRegisteredNode(dbInstance, "peer1");

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
        paidBy: "client",
        quota: BigInt(10),
      });
      const createdQuota = await db.createQuota(dbInstance, mockQuota);

      await db.deleteQuota(dbInstance, createdQuota.id);

      try {
        await db.getQuota(dbInstance, createdQuota.id ?? 0);
      } catch (e) {
        if (e instanceof errors.QueryResultError) {
          assert.equal(e.message, "No data returned from the query.");
        }
      }
    });
    it("should save funding request", async function () {
      await db.saveRegisteredNode(dbInstance, createMockNode("peer1"));

      const node = await db.getRegisteredNode(dbInstance, "peer1");

      const createdFundedRequest = await db.createFundingRequest(dbInstance, {
        registered_node_id: node.id,
        request_id: Math.floor(Math.random() * 1e6),
        amount: BigInt("1"),
      });

      assert.equal(createdFundedRequest.registered_node_id, node.id);
    });
  });
});
