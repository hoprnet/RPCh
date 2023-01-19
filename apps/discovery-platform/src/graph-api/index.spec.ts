import assert from "assert";
import { checkCommitment, validateNode } from "./index";
import { GetAccountChannelsResponse } from "./dto";
import { QueryRegisteredNode } from "../registered-node/dto";
import nock from "nock";

const GRAPH_HOPR_URL =
  "https://api.thegraph.com/subgraphs/name/hoprnet/hopr-channels";

const mockGraphResponse: (
  numOfChannels: number,
  balancePerChannel: number
) => GetAccountChannelsResponse = (
  numOfChannels: number,
  balancePerChannel: number
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

const createMockNode = (peerId?: string): QueryRegisteredNode => ({
  chain_id: 100,
  id: peerId ?? "peerId",
  has_exit_node: true,
  honesty_score: 0,
  status: "FRESH",
  total_amount_funded: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  exit_node_pub_key: "somePubKey",
  hoprd_api_endpoint: "someEndpoint",
  hoprd_api_port: 0,
  native_address: "someAddress",
});

describe("test graph api functions", function () {
  describe("validate node", function () {
    it("should return false if not enough channels are open", function () {
      const MIN_BALANCE = 1;
      const MIN_CHANNELS_OPEN = 5;
      const isValidated = validateNode(
        mockGraphResponse(3, 1),
        MIN_BALANCE,
        MIN_CHANNELS_OPEN
      );
      assert(!isValidated);
    });
    it("should return false if not enough balance are in the channels", function () {
      const MIN_BALANCE = 4;
      const MIN_CHANNELS_OPEN = 5;
      const isValidated = validateNode(
        mockGraphResponse(3, 1),
        MIN_BALANCE,
        MIN_CHANNELS_OPEN
      );
      assert(!isValidated);
    });
    it("should return true if enough channels are open and enough balance is inside the channels", function () {
      const MIN_BALANCE = 4;
      const MIN_CHANNELS_OPEN = 3;
      const isValidated = validateNode(
        mockGraphResponse(3, 2),
        MIN_BALANCE,
        MIN_CHANNELS_OPEN
      );
      assert(isValidated);
    });
  });
  describe("check commitment", function () {
    it("should return false if not enough channels are open", async function () {
      const node: QueryRegisteredNode = createMockNode();
      const MIN_BALANCE = 1;
      const MIN_CHANNELS_OPEN = 5;
      nock(GRAPH_HOPR_URL).post(/.*/).reply(200, mockGraphResponse(3, 1), {
        "content-type": "application/json",
      });
      const isCommitted = await checkCommitment({
        node,
        minBalance: MIN_BALANCE,
        minChannels: MIN_CHANNELS_OPEN,
      });
      assert.equal(isCommitted, false);
    });
    it("should return true if enough channels are open", async function () {
      const node: QueryRegisteredNode = createMockNode();
      const MIN_BALANCE = 1;
      const MIN_CHANNELS_OPEN = 5;
      nock(GRAPH_HOPR_URL).post(/.*/).reply(200, mockGraphResponse(5, 1), {
        "content-type": "application/json",
      });
      const isCommitted = await checkCommitment({
        node,
        minBalance: MIN_BALANCE,
        minChannels: MIN_CHANNELS_OPEN,
      });

      assert.equal(isCommitted, true);
    });
  });
});
