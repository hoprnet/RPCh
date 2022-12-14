import { fixtures } from "rpch-common";
import ReliabilityScore from "./reliability-score";

// TODO: Delete the 'testme' script from package.json

const ENTRY_NODE_PEER_ID = fixtures.PEER_ID_A;

describe("test reliability score class", () => {
  let reliabilityScore: ReliabilityScore;

  beforeEach(() => {
    reliabilityScore = new ReliabilityScore();
  });

  const add20Metrics = (peerId: string) => {
    for (let count = 1; count <= 20; count++) {
      reliabilityScore.addMetric(peerId, `request${count}`, "success");
    }
  };

  it("should add metrics", () => {
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request01", "success");
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request02", "dishonest");
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request03", "failed");
    const entryNode = reliabilityScore.metrics.get(ENTRY_NODE_PEER_ID);

    expect(entryNode?.sent).toBe(3);
    expect(entryNode?.responses.size).toBe(3);
  });
  it("should have a score of 0 for unexistent nodes", () => {
    const score = reliabilityScore.getScore("unexistentPeerId");

    expect(score).toBe(0);
  });
  it("should have a score of 0.2 for fresh nodes", () => {
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request01", "success");
    const score = reliabilityScore.getScore(ENTRY_NODE_PEER_ID);

    expect(score).toBe(0.2);
  });
  it("should calculate score for ready nodes", () => {
    add20Metrics(ENTRY_NODE_PEER_ID);
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request21", "failed");
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request22", "failed");

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
  it.todo(
    "should remove metrics which are less than MAX_RESPONSES except dishonest ones"
  );
  it.todo("should set metrics");
});
