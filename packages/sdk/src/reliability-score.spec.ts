import { fixtures } from "rpch-common";
import ReliabilityScore, { MAX_RESPONSES } from "./reliability-score";

const ENTRY_NODE_PEER_ID = fixtures.PEER_ID_A;

describe("test reliability score class", () => {
  let reliabilityScore: ReliabilityScore;

  beforeEach(() => {
    reliabilityScore = new ReliabilityScore();
  });

  it("should add metrics", () => {
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request01", "success");
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request02", "dishonest");

    expect(
      reliabilityScore.metrics.get(ENTRY_NODE_PEER_ID)?.responses.size
    ).toBe(2);
  });
  it("should have a score of 0.2 for fresh nodes", () => {
    // TODO: Update the sent value.
    reliabilityScore.addMetric(ENTRY_NODE_PEER_ID, "request01", "success");
    const score = reliabilityScore.getScore(ENTRY_NODE_PEER_ID);

    expect(score).toBe(0.2);
  });
  it.todo("should calculate score for ready nodes");
  it.todo(
    "should remove metrics which are less than MAX_RESPONSES except dishonest ones"
  );
  it.todo("should set metrics");
  it("should get all scores", () => {
    reliabilityScore.addMetric("16Uiu2peerId1", "request01", "success");
    reliabilityScore.addMetric("16Uiu2peerId2", "request02", "dishonest");
    reliabilityScore.addMetric("16Uiu2peerId3", "request03", "none");

    const scores = reliabilityScore.getScores();

    expect(scores).toHaveLength(3);
  });
});
