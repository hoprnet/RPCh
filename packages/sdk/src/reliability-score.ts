import { utils } from "rpch-common";

/**
 * Possible `result` values.
 * @type success: we have received an honest and valid response.
 * @type dishonest: we have received a response but Kevlar says its not honest.
 * @type failed: we have received no response for that request.
 */
export type Result = "success" | "dishonest" | "failed";

export type ResponseMetric = {
  id: string;
  createdAt: Date;
  result: Result;
};

export type Stats = {
  success: number;
  dishonest: number;
  failed: number;
};

// ! Need to export these?
export const FRESH_NODE_THRESHOLD = 20;
export const MAX_RESPONSES = 100;

/**
 * Way to measure if the HOPRd entry node
 * we are using is reliable or not.
 */
export default class ReliabilityScore {
  /**
   * Keeps track of metrics.
   */
  // ! metrics should be public or private?
  public metrics = new Map<
    string,
    {
      responses: Map<string, ResponseMetric>;
      stats: Stats;
      sent: number;
      updatedAt: Date;
    }
  >();

  /**
   * Keeps track of calculated score.
   * The `score` range goes from 0 to 1.
   */
  private score = new Map<string, number>();

  /**
   * Get a node's responses.result stats.
   * @param peerId
   * @returns object with number of successful, dishonest and failed responses.
   */
  private getResultsStats(peerId: string): Stats {
    if (this.metrics.has(peerId)) {
      const responses = Array.from(this.metrics.get(peerId)!.responses);
      return responses.reduce(
        (acc, [_, response]) => {
          if (response.result === "success") {
            acc.success++;
          } else if (response.result === "dishonest") {
            acc.dishonest++;
          } else if (response.result === "failed") {
            acc.failed++;
          }
          return acc;
        },
        { success: 0, dishonest: 0, failed: 0 }
      );
    } else return { success: 0, dishonest: 0, failed: 0 };
  }

  /**
   * Add new metric to the metrics Map.
   * @param peerId
   * @param requestId
   * @param result
   */
  public addMetric(peerId: string, requestId: string, result: Result) {
    let nodeMetrics = this.metrics.get(peerId);

    if (!nodeMetrics) {
      nodeMetrics = {
        responses: new Map<string, ResponseMetric>(),
        stats: { success: 0, dishonest: 0, failed: 0 },
        sent: 0,
        updatedAt: new Date(),
      };
      this.metrics.set(peerId, nodeMetrics);
    }

    nodeMetrics.responses.set(requestId, {
      id: `id${utils.generateRandomNumber()}`,
      createdAt: new Date(),
      result,
    });

    nodeMetrics.sent += 1;
    nodeMetrics.stats = this.getResultsStats(peerId);

    // Remove all responses except those with a dishonest result.
    if (nodeMetrics.sent > MAX_RESPONSES) {
      for (const [requestId, { result }] of nodeMetrics.responses) {
        if (result !== "dishonest") {
          nodeMetrics.responses.delete(requestId);
          nodeMetrics.sent = 0;
        } else {
          nodeMetrics.sent = 1;
        }
      }

      nodeMetrics.stats = this.getResultsStats(peerId);
      const score = this.getScore(peerId);
      this.score.set(peerId, score);
    }
  }

  /**
   * Get node score.
   * @param peerId
   * @returns peerId score.
   */
  public getScore(peerId: string) {
    if (this.metrics.has(peerId)) {
      const sent = this.metrics.get(peerId)?.sent || 0;
      const dishonest = this.metrics.get(peerId)?.stats.dishonest || 0;
      const failed = this.metrics.get(peerId)?.stats.failed || 0;

      if (sent < FRESH_NODE_THRESHOLD) {
        this.score.set(peerId, 0.2);
      } else if (dishonest > 0) {
        this.score.set(peerId, 0);
      } else {
        const score = (sent - failed) / sent;
        this.score.set(peerId, score);
      }
      return this.score.get(peerId) || 0;
    } else {
      return 0;
    }
  }

  /**
   * Get all node scores.
   * @returns array of peerId and score objects.
   */
  public getScores() {
    const entries = Array.from(this.metrics);
    return entries.map(([peerId]) => {
      const score = this.getScore(peerId);
      return { peerId, score };
    });
  }
}
