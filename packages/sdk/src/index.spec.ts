import assert from "assert";
import { Request, fixtures } from "rpch-common";
import nock from "nock";
import SDK, { type HoprSdkTempOps } from "./index";

const TIMEOUT = 5e3;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_TOKEN = "12345";
const ENTRY_NODE_PEER_ID = fixtures.PEER_ID_A;
const EXIT_NODE_PEER_ID = fixtures.PEER_ID_B;
const FRESH_NODE_THRESHOLD = 20;
const MAX_RESPONSES = 100;

type MockOps = HoprSdkTempOps & { timeout: number };

const createSdkMock = (
  overwriteOps?: Partial<MockOps>
): {
  sdk: SDK;
  ops: MockOps;
} => {
  fixtures
    .nockSendMessageApi(nock(ENTRY_NODE_API_ENDPOINT))
    .reply(202, "someresponse");

  const ops: MockOps = {
    timeout: overwriteOps?.timeout ?? TIMEOUT,
    discoveryPlatformApiEndpoint:
      overwriteOps?.discoveryPlatformApiEndpoint ??
      DISCOVERY_PLATFORM_API_ENDPOINT,
    entryNodeApiEndpoint:
      overwriteOps?.entryNodeApiEndpoint ?? ENTRY_NODE_API_ENDPOINT,
    entryNodeApiToken: overwriteOps?.entryNodeApiToken ?? ENTRY_NODE_API_TOKEN,
    entryNodePeerId: overwriteOps?.entryNodePeerId ?? ENTRY_NODE_PEER_ID,
    exitNodePeerId: overwriteOps?.exitNodePeerId ?? EXIT_NODE_PEER_ID,
    freshNodeThreshold: FRESH_NODE_THRESHOLD,
    maxResponses: MAX_RESPONSES,
  };

  const sdk = new SDK(ops.timeout, ops);

  return { sdk, ops };
};

describe("test SDK class", function () {
  describe("stopped", function () {
    let sdk: SDK;

    beforeEach(async function () {
      sdk = createSdkMock().sdk;
    });

    it("should fail to create request", function () {
      assert.throws(() => {
        return sdk.createRequest(fixtures.PROVIDER, fixtures.RPC_REQ_LARGE);
      }, "not ready");
    });

    it("should fail to send request", function () {
      assert.throws(() => {
        return sdk.sendRequest(fixtures.LARGE_REQUEST);
      }, "not ready");
    });
  });

  describe("started", function () {
    let ops: MockOps;
    let sdk: SDK;

    beforeEach(async function () {
      const mock = createSdkMock();
      ops = mock.ops;
      sdk = mock.sdk;
      await sdk.start();
    });

    afterEach(async function () {
      await sdk.stop();
    });

    it("should create request", async function () {
      const request = sdk.createRequest(
        fixtures.PROVIDER,
        fixtures.RPC_REQ_LARGE
      );
      assert(request instanceof Request);
      assert.equal(request.origin, ops.entryNodePeerId);
      assert.equal(request.provider, fixtures.PROVIDER);
      assert.equal(request.body, fixtures.RPC_REQ_LARGE);
    });

    it("should send request and return response", function (done) {
      sdk.sendRequest(fixtures.LARGE_REQUEST).then((response) => {
        assert.equal(response.id, fixtures.LARGE_RESPONSE.id);
        // @ts-ignore
        const pendingRequest = sdk.requestCache.getRequest(
          fixtures.LARGE_RESPONSE.id
        );
        assert.equal(pendingRequest, undefined);
        done();
      });

      // @ts-ignore
      sdk.onResponseFromSegments(fixtures.LARGE_RESPONSE);
    });

    it("should call addMetric when onResponseFromSegments is triggered", function (done) {
      //@ts-ignore
      const addMetricMock = jest.spyOn(sdk.reliabilityScore, "addMetric");

      sdk.sendRequest(fixtures.SMALL_REQUEST);
      sdk.sendRequest(fixtures.LARGE_REQUEST).then(() => done());

      // @ts-ignore
      sdk.onResponseFromSegments(fixtures.SMALL_RESPONSE);
      // @ts-ignore
      sdk.onResponseFromSegments(fixtures.LARGE_RESPONSE);

      assert.equal(addMetricMock.mock.calls.length, 2);
      assert(addMetricMock.mock.calls.at(0)?.includes("success"));
    });

    it("should call addMetric when onRequestRemoval is triggered", function () {
      //@ts-ignore
      const addMetricMock = jest.spyOn(sdk.reliabilityScore, "addMetric");
      // @ts-ignore
      sdk.requestCache.addRequest(
        fixtures.LARGE_REQUEST,
        () => {},
        () => {}
      );
      // @ts-ignore
      sdk.onRequestRemoval(fixtures.LARGE_REQUEST);
      assert.equal(addMetricMock.mock.calls.length, 1);
      assert(addMetricMock.mock.calls.at(0)?.includes("failed"));
    });

    describe("should handle requests correctly when receiving a response", function () {
      it("should remove request with matching response", function () {
        // @ts-ignore
        sdk.requestCache.addRequest(
          fixtures.LARGE_REQUEST,
          () => {},
          () => {}
        );
        // @ts-ignore
        sdk.onResponseFromSegments(fixtures.LARGE_RESPONSE);
        assert.equal(
          // @ts-ignore
          sdk.requestCache.getRequest(fixtures.LARGE_RESPONSE.id),
          undefined
        );
      });
      it("shouldn't remove request with different response", function () {
        // @ts-ignore
        sdk.requestCache.addRequest(
          fixtures.LARGE_REQUEST,
          () => {},
          () => {}
        );
        // @ts-ignore
        sdk.onResponseFromSegments(fixtures.SMALL_RESPONSE);
        assert.equal(
          // @ts-ignore
          sdk.requestCache.getRequest(fixtures.LARGE_RESPONSE.id)?.request.id,
          fixtures.LARGE_REQUEST.id
        );
      });
    });
  });
});
