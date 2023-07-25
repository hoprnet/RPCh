import assert from "assert";
import { checkCommitment, validateNode } from "./index";
import { RegisteredNodeDB, GetAccountChannelsResponse } from "../types";

const mockGraphResponse: (
  numOfChannels: number,
  balancePerChannel: string
) => GetAccountChannelsResponse = (
  numOfChannels: number,
  balancePerChannel: string
) => ({
  data: {
    account: {
      fromChannels: Array.from({ length: numOfChannels }).map((_, index) => ({
        id: String(index),
        balance: balancePerChannel,
      })),
    },
  },
});

const createMockNode = (peerId?: string): RegisteredNodeDB => ({
  chain_id: 100,
  id: peerId ?? "peerId",
  has_exit_node: true,
  honesty_score: 0,
  status: "FRESH",
  total_amount_funded: BigInt(0),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  exit_node_pub_key: "somePubKey",
  hoprd_api_endpoint: "someEndpoint:0",
  hoprd_api_token: "someToken",
  native_address: "someAddress",
});

describe("test graph api functions", function () {
  describe("validate node", function () {
    it("should return false if not enough channels are open", function () {
      const MIN_BALANCE = 1;
      const MIN_CHANNELS_OPEN = 5;
      const isValidated = validateNode(
        mockGraphResponse(3, "1"),
        MIN_BALANCE,
        MIN_CHANNELS_OPEN
      );
      assert(!isValidated);
    });
    it("should return false if not enough balance are in the channels", function () {
      const MIN_BALANCE = 4;
      const MIN_CHANNELS_OPEN = 5;
      const isValidated = validateNode(
        mockGraphResponse(3, "1"),
        MIN_BALANCE,
        MIN_CHANNELS_OPEN
      );
      assert(!isValidated);
    });
    it("should return true if enough channels are open and enough balance is inside the channels", function () {
      const MIN_BALANCE = 4;
      const MIN_CHANNELS_OPEN = 3;
      const isValidated = validateNode(
        mockGraphResponse(3, "2"),
        MIN_BALANCE,
        MIN_CHANNELS_OPEN
      );
      assert(isValidated);
    });
  });
  describe("check commitment", function () {
    it("should return false if not enough channels are open", async function () {
      const node: RegisteredNodeDB = createMockNode();
      const MIN_BALANCE = 1;
      const MIN_CHANNELS_OPEN = 5;

      const isCommitted = await checkCommitment({
        channels: mockGraphResponse(1, "1"),
        node,
        minBalance: MIN_BALANCE,
        minChannels: MIN_CHANNELS_OPEN,
      });
      assert.equal(isCommitted, false);
    });
    it("should return true if enough channels are open", async function () {
      const node: RegisteredNodeDB = createMockNode();
      const MIN_BALANCE = 1;
      const MIN_CHANNELS_OPEN = 5;

      const isCommitted = await checkCommitment({
        channels: mockGraphResponse(6, "1"),
        node,
        minBalance: MIN_BALANCE,
        minChannels: MIN_CHANNELS_OPEN,
      });

      assert.equal(isCommitted, true);
    });
  });
});
