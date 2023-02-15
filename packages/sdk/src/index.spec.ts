import assert from "assert";
import { Request, hoprd } from "@rpch/common";
import * as fixtures from "@rpch/common/build/fixtures";
import nock from "nock";
import SDK, { type HoprSdkOps } from "./index";
import { expect } from "@jest/globals";

const TIMEOUT = 5e3;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_PORT = "1337";
const ENTRY_NODE_API_TOKEN = "12345";
const ENTRY_NODE_PEER_ID = fixtures.HOPRD_PEER_ID_A;
const EXIT_NODE_PEER_ID = fixtures.EXIT_NODE_HOPRD_PEER_ID_A;
const EXIT_NODE_PUB_KEY = fixtures.EXIT_NODE_PUB_KEY_A;

jest.mock("@rpch/common", () => ({
  ...jest.requireActual("@rpch/common"),
  hoprd: {
    ...jest.requireActual("@rpch/common").hoprd,
    createMessageListener: jest.fn(async () => {
      return () => {};
    }),
  },
}));

const DP_GET_NODES = nock(DISCOVERY_PLATFORM_API_ENDPOINT).get(
  "/api/v1/node?hasExitNode=true"
);

const DP_REQ_ENTRY_NOCK = nock(DISCOVERY_PLATFORM_API_ENDPOINT).post(
  "/api/v1/request/entry-node"
);

const HOPRD_SEND_MESSAGE_NOCK = nock(ENTRY_NODE_API_ENDPOINT).post(
  "/api/v2/messages"
);

const createSdkMock = (
  overwriteOps?: Partial<HoprSdkOps>
): {
  sdk: SDK;
  ops: HoprSdkOps;
} => {
  const store = fixtures.createAsyncKeyValStore();

  const ops: HoprSdkOps = {
    client: "",
    timeout: overwriteOps?.timeout ?? TIMEOUT,
    discoveryPlatformApiEndpoint:
      overwriteOps?.discoveryPlatformApiEndpoint ??
      DISCOVERY_PLATFORM_API_ENDPOINT,
    reliabilityScoreFreshNodeThreshold: 1,
  };

  const sdk = new SDK(ops, store.set, store.get);
  // @ts-ignore
  jest.spyOn(sdk, "fetchExitNodes");
  return { sdk, ops };
};

describe("test SDK class", function () {
  describe("stopped", function () {
    let sdk: SDK;

    beforeEach(async function () {
      sdk = createSdkMock().sdk;
    });

    it("should fail to create request", async function () {
      await expect(
        sdk.createRequest(fixtures.PROVIDER, fixtures.RPC_REQ_LARGE)
      ).rejects.toThrow("SDK not ready to create requests");
    });

    it("should fail to send request", async function () {
      const request = fixtures.createMockedFlow().next().value as Request;

      await expect(sdk.sendRequest(request)).rejects.toThrow(
        "SDK not ready to send requests"
      );
    });
  });

  describe("started", function () {
    let ops: HoprSdkOps;
    let sdk: SDK;

    beforeEach(async function () {
      const mock = createSdkMock();
      ops = mock.ops;
      sdk = mock.sdk;
      DP_REQ_ENTRY_NOCK.thrice().reply(200, {
        hoprd_api_endpoint: ENTRY_NODE_API_ENDPOINT,
        hoprd_api_port: ENTRY_NODE_API_PORT,
        accessToken: ENTRY_NODE_API_TOKEN,
        id: ENTRY_NODE_PEER_ID,
      });

      DP_GET_NODES.reply(200, [
        {
          exit_node_pub_key: EXIT_NODE_PUB_KEY,
          id: EXIT_NODE_PEER_ID,
        },
      ]).persist(true);
      await sdk.start();
    });

    afterEach(async function () {
      await sdk.stop();
      jest.clearAllMocks();
    });

    it("should create request", async function () {
      const request = await sdk.createRequest(
        fixtures.PROVIDER,
        fixtures.RPC_REQ_LARGE
      );
      assert(request instanceof Request);
      assert.equal(request.entryNodeDestination, ENTRY_NODE_PEER_ID);
      assert.equal(request.provider, fixtures.PROVIDER);
      assert.equal(request.body, fixtures.RPC_REQ_LARGE);
    });

    it("should send request and return response", function (done) {
      HOPRD_SEND_MESSAGE_NOCK.reply(202, "someresponse");

      const [clientRequest, , exitNodeResponse] =
        fixtures.generateMockedFlow(3);

      sdk.sendRequest(clientRequest).then((response) => {
        assert.equal(response.id, clientRequest.id);
        // @ts-ignore
        const pendingRequest = sdk.requestCache.getRequest(clientRequest.id);
        assert.equal(pendingRequest, undefined);
        done();
      });

      // @ts-ignore
      sdk.onMessage(exitNodeResponse.toMessage());
    });

    it("should call `addMetric` when `onMessage` is triggered", async function () {
      HOPRD_SEND_MESSAGE_NOCK.reply(202, "someresponse");

      //@ts-ignore
      const addMetricMock = jest.spyOn(sdk.reliabilityScore, "addMetric");

      const [smallRequest, , smallResponse] = fixtures.generateMockedFlow(
        3,
        fixtures.RPC_REQ_SMALL,
        undefined,
        fixtures.RPC_RES_SMALL
      );
      const [largeRequest, , largeResponse] = fixtures.generateMockedFlow(
        3,
        fixtures.RPC_REQ_LARGE,
        undefined,
        fixtures.RPC_RES_LARGE
      );

      let p1 = sdk.sendRequest(smallRequest);
      let p2 = sdk.sendRequest(largeRequest);

      // @ts-ignore
      sdk.onMessage(smallResponse.toMessage());
      // @ts-ignore
      sdk.onMessage(largeResponse.toMessage());

      await Promise.all([p1, p2]);

      assert.equal(addMetricMock.mock.calls.length, 2);
      assert(addMetricMock.mock.calls.at(0)?.includes("success"));
    });

    it("should call addMetric when onRequestRemoval is triggered", function () {
      HOPRD_SEND_MESSAGE_NOCK.reply(202, "someresponse");

      const [largeRequest, , largeResponse] = fixtures.generateMockedFlow(
        3,
        fixtures.RPC_REQ_LARGE,
        undefined,
        fixtures.RPC_RES_LARGE
      );

      //@ts-ignore
      const addMetricMock = jest.spyOn(sdk.reliabilityScore, "addMetric");
      // @ts-ignore
      sdk.requestCache.addRequest(
        largeRequest,
        () => {},
        () => {}
      );
      // @ts-ignore
      sdk.onRequestRemoval(largeResponse);
      assert.equal(addMetricMock.mock.calls.length, 1);
      assert(addMetricMock.mock.calls.at(0)?.includes("failed"));
    });

    describe("should select reliable node", function () {
      it("selects new node when selected node is dishonest", async function () {
        // Make original selected node have a low score
        // @ts-ignore
        sdk.reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, 1, "dishonest");
        // @ts-ignore
        sdk.reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, 2, "dishonest");

        // select a new reliable node
        // @ts-ignore
        sdk.selectEntryNode = jest.fn(() => {
          // @ts-ignore
          sdk.entryNode = {
            apiEndpoint: "reliableEndpoint",
            apiToken: "reliableToken",
            peerId: "reliablePeerId",
          };
        });
        const request = await sdk.createRequest(
          fixtures.PROVIDER,
          fixtures.RPC_REQ_LARGE
        );

        // @ts-ignore
        assert.equal(sdk.selectEntryNode.mock.calls.length, 1);
        assert.equal(request.entryNodeDestination, "reliablePeerId");
      });

      it("does not select new node when node is fresh", async function () {
        // @ts-ignore
        const addMetricsEntryNode = jest.spyOn(sdk, "selectEntryNode");
        await sdk.createRequest(fixtures.PROVIDER, fixtures.RPC_REQ_LARGE);
        assert.equal(addMetricsEntryNode.mock.calls.length, 0);
      });

      it("does not select new node when node score is ok", async function () {
        // @ts-ignore
        const addMetricsEntryNode = jest.spyOn(sdk, "selectEntryNode");
        // @ts-ignore
        sdk.reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, 1, "success");
        // @ts-ignore
        sdk.reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, 1, "success");

        await sdk.createRequest(fixtures.PROVIDER, fixtures.RPC_REQ_LARGE);
        assert.equal(addMetricsEntryNode.mock.calls.length, 0);
      });

      it("should not select more than one entry node at a time", async function () {
        // Make original selected node have a low score
        // @ts-ignore
        sdk.reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, 1, "dishonest");
        // @ts-ignore
        sdk.reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, 2, "dishonest");

        // select a new reliable node
        // @ts-ignore
        sdk.selectEntryNode = jest.fn(() => {
          // @ts-ignore
          sdk.entryNode = {
            apiEndpoint: "reliableEndpoint",
            apiToken: "reliableToken",
            peerId: "reliablePeerId",
          };
        });

        // send bulk requests
        try {
          await Promise.all([
            sdk.createRequest(fixtures.PROVIDER, fixtures.RPC_REQ_LARGE),
            sdk.createRequest(fixtures.PROVIDER, fixtures.RPC_REQ_LARGE),
            sdk.createRequest(fixtures.PROVIDER, fixtures.RPC_REQ_LARGE),
          ]);
        } catch (e: any) {
          assert.equal(e.message, "SDK is selecting entry node");
          // @ts-ignore
          assert.equal(sdk.selectEntryNode.mock.calls.length, 1);
        }
      });
    });

    it("should fetch exit nodes", async function () {
      // @ts-ignore
      assert.equal(sdk.fetchExitNodes.mock.calls.length, 1);
      // @ts-ignore
      assert.equal(sdk.exitNodes.length, 1);
    });

    it("should throw error when no entry node is available", async function () {
      DP_REQ_ENTRY_NOCK.once().reply(404, {
        body: "someError",
      });

      await expect(
        // @ts-ignore
        sdk.selectEntryNode(DISCOVERY_PLATFORM_API_ENDPOINT)
      ).rejects.toThrow();
    });

    it("should not allow creating a request if sdk is deadlocked", async function () {
      sdk.setDeadlock(10e6);
      try {
        await sdk.createRequest(fixtures.PROVIDER, fixtures.RPC_REQ_LARGE);
      } catch (e: any) {
        expect(e.message).toMatch("SDK is deadlocked");
      }
    });

    it("should not allow sending requests if sdk is deadlocked", async function () {
      sdk.setDeadlock(10e6);
      const [clientRequest] = fixtures.generateMockedFlow(3);
      try {
        await sdk.sendRequest(clientRequest);
      } catch (e: any) {
        expect(e.message).toMatch("SDK is deadlocked");
      }
      sdk.setDeadlock(0);
    });
    it("should not save request to requestCache if request to hoprd fails", async function () {
      HOPRD_SEND_MESSAGE_NOCK.reply(400, "error");
      const [clientRequest] = fixtures.generateMockedFlow(3);
      try {
        await sdk.sendRequest(clientRequest);
      } catch (e: any) {
        // @ts-ignore
        assert.equal(sdk.requestCache.getRequest(clientRequest.id), undefined);
      }
    });

    it("should add only one failed request to metrics if hoprd fails", async function () {
      HOPRD_SEND_MESSAGE_NOCK.reply(400, "error");
      const request = fixtures.createMockedFlow(fixtures.RPC_REQ_LARGE).next()
        .value as Request;
      try {
        await sdk.sendRequest(request);
      } catch (e: any) {
        assert.equal(
          // @ts-ignore
          sdk.reliabilityScore.metrics.get(sdk.entryNode?.peerId)?.stats.failed,
          1
        );
      }
      assert.equal(
        // @ts-ignore
        sdk.reliabilityScore.metrics.get(sdk.entryNode?.peerId)?.sent,
        1
      );
    });

    it("should call the stopMessageListener if entry node changes", async function () {
      // @ts-ignore
      const stopMessageListenerMetric = jest.spyOn(sdk, "stopMessageListener");
      // @ts-ignore
      sdk.reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, 1, "dishonest");
      // @ts-ignore
      sdk.reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, 2, "dishonest");

      // Check that before node is seen as not reliable enough, messageListener isn't stopped
      assert.equal(stopMessageListenerMetric.mock.calls.length, 0);
      const request = await sdk.createRequest(
        fixtures.PROVIDER,
        fixtures.RPC_REQ_LARGE
      );

      // After createRequest, node should not be reliable enough and messageListener
      // should've been stopped to refresh entry node
      assert.equal(stopMessageListenerMetric.mock.calls.length, 1);
    });

    it("should call the createMessageListener one more time if entry node changes", async function () {
      // @ts-ignore
      const createMessageListenerMetric = jest.spyOn(
        hoprd,
        "createMessageListener"
      );
      // @ts-ignore
      sdk.reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, 1, "dishonest");
      // @ts-ignore
      sdk.reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, 2, "dishonest");

      // createMessageListener should have been called once (when sdk starts)
      assert.equal(createMessageListenerMetric.mock.calls.length, 1);
      const request = await sdk.createRequest(
        fixtures.PROVIDER,
        fixtures.RPC_REQ_LARGE
      );

      // createMessageListener should have 2 calls after stopping the previous
      // from old entry node and creating new one with new entry node
      assert.equal(createMessageListenerMetric.mock.calls.length, 2);
    });

    describe("should handle requests correctly when receiving a response", function () {
      it("should remove request with matching response", async function () {
        const [clientRequest, , exitNodeResponse] =
          fixtures.generateMockedFlow(3);

        // @ts-ignore
        sdk.requestCache.addRequest(
          clientRequest,
          () => {},
          () => {}
        );
        // @ts-ignore
        await sdk.onMessage(exitNodeResponse.toMessage());
        assert.equal(
          // @ts-ignore
          sdk.requestCache.getRequest(clientRequest.id),
          undefined
        );
      });
      it("shouldn't remove request with different response", function () {
        const [clientRequestA] = fixtures.generateMockedFlow(
          3,
          fixtures.RPC_REQ_SMALL,
          undefined,
          fixtures.RPC_RES_SMALL
        );
        const [, , exitNodeResponseB] = fixtures.generateMockedFlow(
          3,
          fixtures.RPC_REQ_LARGE,
          undefined,
          fixtures.RPC_RES_LARGE
        );

        // @ts-ignore
        sdk.requestCache.addRequest(
          clientRequestA,
          () => {},
          () => {}
        );
        // @ts-ignore
        sdk.onMessage(exitNodeResponseB.toMessage());
        assert.equal(
          // @ts-ignore
          sdk.requestCache.getRequest(clientRequestA.id)?.request.id,
          clientRequestA.id
        );
      });
    });
  });
});
