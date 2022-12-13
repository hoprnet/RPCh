/**
 * Possible `result` values.
 * @type success: we have received an honest and valid response.
 * @type dishonest: we have received a response but Kevlar says its not honest.
 * @type none: we have received no response for that request.
 */
export type Result = "success" | "dishonest" | "none";

export type ResponseMetric = {
  id: string;
  createdAt: Date;
  result: Result;
};

export const MAX_RESPONSES = 100;

/**
 * Way to measure if the HOPRd entry node
 * we are using is reliable or not.
 */
export default class ReliabilityScore {
  // metrics should be public or private?
  public metrics = new Map<
    string,
    {
      responses: Map<string, ResponseMetric>;
      sent: number;
      updatedAt: Date;
    }
  >();

  /**
   * The score range goes from 0 to 1.
   */
  public score = new Map<string, number>();

  /**
   * Add new metric to the metrics Map.
   * @param peerId
   * @param requestId
   * @param result
   */
  public addMetric(peerId: string, requestId: string, result: Result) {
    // it's like a spread (...) for Maps. How to do this better?
    const responses = this.metrics.has(peerId)
      ? new Map(this.metrics.get(peerId)?.responses)
      : new Map<string, ResponseMetric>();

    this.metrics.set(peerId, {
      responses: responses.set(requestId, {
        id: "id1",
        createdAt: new Date(),
        result,
      }),
      sent: 0,
      updatedAt: new Date(),
    });
  }
  /**
   * Get peerId score.
   * @param peerId
   * @returns peerId score
   */
  public getScore(peerId: string) {
    if (this.metrics.has(peerId)) {
      const sent = this.metrics.get(peerId)!.sent;
      if (sent < 20) {
        this.score.set(peerId, 0.2);
      } else if (sent >= 20) {
        // TODO: Add dishonest.
        const dishonest = 0.1;
        if (dishonest > 0) {
          this.score.set(peerId, 0);
        } else {
          // TODO: Add failed.
          const failed = 0;
          const score = (sent - failed) / sent;
          this.score.set(peerId, score);
        }
      }
      return this.score.get(peerId);
    } else return 0;
  }

  /**
   * Get all scores
   * @returns array of objects with peerId and score
   */
  public getScores() {
    const entries = this.metrics.entries();
    const scores = [];
    for (const entry of entries) {
      const peerId = entry.at(0) as string;
      if (this.metrics.has(peerId)) {
        const score = this.getScore(peerId);
        scores.push({ peerId, score });
      }
    }
    return scores;
  }
}
