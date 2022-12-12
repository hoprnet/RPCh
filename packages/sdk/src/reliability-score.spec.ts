import { fixtures } from "rpch-common";
import ReliabilityScore from "./reliability-score";

const ENTRY_NODE_PEER_ID = fixtures.PEER_ID_A;

describe("test reliability score class", () => {
  let reliabilityScore: ReliabilityScore;

  beforeEach(() => {
    reliabilityScore = new ReliabilityScore();
  });

  it("should add a metric", () => {
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
});

// it("should determine if a node is a fresh node", () => {
//     const sent = 10;
//     expect(sent).toBeLessThan(20);
//   });
//   it("should determine if a node is a ready node", () => {
//     const sent = 21;
//     expect(sent).toBeGreaterThanOrEqual(20);
//   });
//   it("should assing a score of 0.2 to fresh nodes", () => {
//     const sent = 10;
//     // const score = getScore(ENTRY_NODE_PEER_ID);
//     // expect(score).toBe(0.2);
//   });
//   it("should assing a score of 0 if a node is dishonest", () => {
//     let score = 0.3;
//     // where to get this from?
//     const dishonest = 0.1;
//     if (dishonest > 0) {
//       score = 0;
//     }
//     expect(score).toBe(0);
//   });
//   it("should assing score to a ready node", () => {
//     const sent = 21;
//     const received = 0;
//     const score = (sent - received) / sent;
//     expect(score).toBe(1);
//   });
