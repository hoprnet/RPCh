import assert from "assert";
import { checkCommitment, validateNode } from "./index";
import { GraphHoprResponse } from "./dto";
import { QueryRegisteredNode } from "../registered-node/dto";
import nock from "nock";

const GRAPH_HOPR_URL =
  "https://api.thegraph.com/subgraphs/name/hoprnet/hopr-channels";

const mockGraphResponse: (
  numOfResponses: number,
  balancePerResponse: number
) => GraphHoprResponse = (
  numOfResponses: number,
  balancePerResponse: number
) => ({
  data: {
    account: {
      fromChannels: Array.from({ length: numOfResponses }).map((_, index) => ({
        id: String(index),
        balance: balancePerResponse,
      })),
    },
  },
});

const createMockNode = (peerId?: string) =>
  ({
    chainId: 100,
    peerId: peerId ?? "peerId",
    hasExitNode: true,
    honestyScore: 0,
    registeredAt: new Date(Date.now()),
    status: "FRESH",
    totalAmountFunded: 0,
  } as QueryRegisteredNode);

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
      nock(GRAPH_HOPR_URL).post(/.*/).reply(200, mockGraphResponse(3, 1));
      const isCommitted = await checkCommitment({
        node,
        minBalance: MIN_BALANCE,
        minChannels: MIN_CHANNELS_OPEN,
      });
      assert(!isCommitted);
    });
    it("should return true if enough channels are open", async function () {
      const node: QueryRegisteredNode = createMockNode();
      const MIN_BALANCE = 1;
      const MIN_CHANNELS_OPEN = 5;
      nock(GRAPH_HOPR_URL).post(/.*/).reply(200, mockGraphResponse(5, 1));
      const isCommitted = await checkCommitment({
        node,
        minBalance: MIN_BALANCE,
        minChannels: MIN_CHANNELS_OPEN,
      });
      assert(isCommitted);
    });
  });
});
