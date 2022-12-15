import ReliabilityScore, { Result } from "./reliability-score";
import { fixtures, utils } from "rpch-common";

// TODO: Delete the 'testme' script from package.json

const ENTRY_NODE_PEER_ID = fixtures.PEER_ID_A;

describe("test reliability score class", () => {
  let reliabilityScore: ReliabilityScore;

  beforeEach(() => {
    reliabilityScore = new ReliabilityScore();
  });

  /**
   * By using `ReliabilityScore.addMetric()`, adds n amount of metrics to a given node with a specified result.
   *
   * Implements jest fake timers to delay each metric addition by 500ms.
   * @param amount
   * @param peerId
   * @param result
   */
  const addNumberOfMetrics = (
    amount: number,
    peerId: string,
    result: Result
  ) => {
    jest.useFakeTimers();
    for (let count = 1; count <= amount; count++) {
      jest.advanceTimersByTime(500);
      reliabilityScore.addMetric(
        peerId,
        `request${utils.generateRandomNumber()}`,
        result
      );
    }
    jest.useRealTimers();
  };

  it("should add metrics", () => {
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request01", "success");
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request02", "dishonest");
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request03", "failed");
    const entryNode = reliabilityScore.metrics.get(ENTRY_NODE_PEER_ID);

    expect(entryNode?.sent).toBe(3);
    expect(entryNode?.responses.size).toBe(3);
  });
  it("should have a score of 0 for unexistent peerIds", () => {
    const score = reliabilityScore.getScore("unexistentPeerId");

    expect(score).toBe(0);
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
  it("should remove responses which are greater than MAX_RESPONSES except dishonest ones", () => {
    // Adding 100 responses
    addNumberOfMetrics(20, ENTRY_NODE_PEER_ID, "success");
    addNumberOfMetrics(8, ENTRY_NODE_PEER_ID, "failed");
    addNumberOfMetrics(2, ENTRY_NODE_PEER_ID, "dishonest");
    addNumberOfMetrics(70, ENTRY_NODE_PEER_ID, "success");

    const entryNode = reliabilityScore.metrics.get(ENTRY_NODE_PEER_ID);

    expect(entryNode?.responses.size).toBe(100);
    expect(entryNode?.sent).toBe(100);
    expect(reliabilityScore.getScore(ENTRY_NODE_PEER_ID)).toBe(0);

    // Adding 1 more response than MAX_RESPONSES.
    addNumberOfMetrics(1, ENTRY_NODE_PEER_ID, "success");
    // Removing all responses except dishonest ones.

    // Because it will be a fresh node with 0 responses.
    expect(entryNode?.sent).toBe(0);
    // But we keep the 2 dishonest responses.
    expect(entryNode?.responses.size).toBe(2);
    expect(reliabilityScore.getScore(ENTRY_NODE_PEER_ID)).toBe(0.2);

    // Adding some dishonest responses.
    addNumberOfMetrics(5, ENTRY_NODE_PEER_ID, "dishonest");
    addNumberOfMetrics(5, ENTRY_NODE_PEER_ID, "failed");
    addNumberOfMetrics(12, ENTRY_NODE_PEER_ID, "success");

    expect(entryNode?.sent).toBe(22);
    expect(reliabilityScore.getScore(ENTRY_NODE_PEER_ID)).toBe(0);
  });
  it.todo("should set metrics");
});
