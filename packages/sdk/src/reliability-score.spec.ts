import ReliabilityScore, { Result } from "./reliability-score";
import { fixtures, utils } from "rpch-common";

const ENTRY_NODE_PEER_ID = fixtures.PEER_ID_A;
const FRESH_NODE_THRESHOLD = 20;
const MAX_RESPONSES = 100;

describe("test reliability score class", () => {
  let reliabilityScore: ReliabilityScore;

  beforeEach(() => {
    reliabilityScore = new ReliabilityScore(
      FRESH_NODE_THRESHOLD,
      MAX_RESPONSES
    );
  });

  /**
   * By using `ReliabilityScore.addMetric()`, adds n amount of metrics to a given node with a specified result.
   * @param amount
   * @param peerId
   * @param result
   */
  const addNumberOfMetrics = (
    amount: number,
    peerId: string,
    result: Result
  ) => {
    for (let count = 1; count <= amount; count++) {
      reliabilityScore.addMetric(
        peerId,
        `request${utils.generateRandomNumber()}`,
        result
      );
    }
  };

  it("should add metrics", () => {
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request01", "success");
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request02", "dishonest");
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request03", "failed");

    // @ts-ignore-next-line
    const entryNode = reliabilityScore.metrics.get(ENTRY_NODE_PEER_ID);

    expect(entryNode?.sent).toBe(3);
    expect(entryNode?.responses.size).toBe(3);
  });
  it("should have a score of 0 for nonexistent peerIds", () => {
    const score = reliabilityScore.getScore("nonexistentPeerId");

    expect(score).toBe(0);
  });
  it("should have score of 0 for dishonest nodes", () => {
    addNumberOfMetrics(19, ENTRY_NODE_PEER_ID, "success");
    addNumberOfMetrics(1, ENTRY_NODE_PEER_ID, "dishonest");

    const score = reliabilityScore.getScore(ENTRY_NODE_PEER_ID);

    expect(score).toBe(0);
  });
  it("shouldn't have stats for nonexistent nodes", () => {
    // @ts-ignore-next-line
    const stats = reliabilityScore.getResultsStats("nonexistentPeerId");

    expect(stats).toMatchObject({ success: 0, dishonest: 0, failed: 0 });
  });
  it("should have a score of 0.2 for fresh nodes", () => {
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request01", "success");
    const score = reliabilityScore.getScore(ENTRY_NODE_PEER_ID);

    expect(score).toBe(0.2);
  });
  it("should calculate score for ready nodes", () => {
    addNumberOfMetrics(20, ENTRY_NODE_PEER_ID, "success");
    addNumberOfMetrics(2, ENTRY_NODE_PEER_ID, "failed");

    // score = (22 - 2)/22 => 0.9090909090909091
    expect(reliabilityScore.getScore(ENTRY_NODE_PEER_ID)).toBe(
      0.9090909090909091
    );
  });

  it("should get all scores", () => {
    reliabilityScore.addMetric("16Uiu2peerId1", "request01", "success");
    reliabilityScore.addMetric("16Uiu2peerId2", "request02", "dishonest");
    reliabilityScore.addMetric("16Uiu2peerId3", "request03", "failed");

    const scores = reliabilityScore.getScores();

    expect(scores).toHaveLength(3);

    for (const item of scores) {
      expect(typeof item.peerId).toBe("string");
      expect(typeof item.score).toBe("number");

      // because all 3 are fresh nodes
      expect(item.score).toBe(0.2);
    }
  });
  it("should remove all responses when MAX_RESPONSES is surpassed", () => {
    addNumberOfMetrics(90, ENTRY_NODE_PEER_ID, "success");
    addNumberOfMetrics(10, ENTRY_NODE_PEER_ID, "failed");

    // @ts-ignore-next-line
    const entryNode = reliabilityScore.metrics.get(ENTRY_NODE_PEER_ID);
    expect(entryNode?.responses.size).toBe(100);
    expect(entryNode?.sent).toBe(100);

    addNumberOfMetrics(5, ENTRY_NODE_PEER_ID, "success");
    expect(entryNode?.responses.size).toBe(5);
    expect(entryNode?.sent).toBe(5);
  });
  it("should remove responses which are greater than MAX_RESPONSES except dishonest ones", () => {
    // Adding 100 responses
    addNumberOfMetrics(90, ENTRY_NODE_PEER_ID, "success");
    addNumberOfMetrics(8, ENTRY_NODE_PEER_ID, "failed");
    addNumberOfMetrics(2, ENTRY_NODE_PEER_ID, "dishonest");

    // @ts-ignore-next-line
    const entryNode = reliabilityScore.metrics.get(ENTRY_NODE_PEER_ID);

    addNumberOfMetrics(1, ENTRY_NODE_PEER_ID, "success");
    expect(entryNode?.sent).toBe(1);

    // 2 dishonest responses and 1 successful.
    expect(entryNode?.responses.size).toBe(3);
  });
  it.todo("should set metrics");
});
