import { createLogger } from "./utils";

const log = createLogger(["reliability-score"]);

const FRESH_NODE_SCORE: number = 0.2;

/**
 * Possible `result` values.
 * @type success: we have received an honest and valid response.
 * @type dishonest: we have received a response but Kevlar says its not honest.
 * @type failed: we have received no response for that request.
 */
export type Result = "success" | "dishonest" | "failed";

export type ResponseMetric = {
  createdAt: Date;
  result: Result;
};

export type Stats = {
  success: number;
  dishonest: number;
  failed: number;
};

/**
 * Way to measure if the HOPRd entry node
 * we are using is reliable or not.
 */
export default class ReliabilityScore {
  /**
   * Keeps track of metrics.
   */
  private metrics = new Map<
    string,
    {
      responses: Map<number, ResponseMetric>;
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
  private FRESH_NODE_THRESHOLD: number;
  private MAX_RESPONSES: number;

  constructor(freshNodeThreshold: number, maxResponses: number) {
    this.FRESH_NODE_THRESHOLD = freshNodeThreshold;
    this.MAX_RESPONSES = maxResponses;
  }

  /**
   * Get a node's responses.result stats.
   * @param peerId
   * @returns object with number of successful, dishonest and failed responses.
   */
  private getResultsStats(peerId: string): Stats {
    if (!this.metrics.has(peerId)) {
      return { success: 0, dishonest: 0, failed: 0 };
    }

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
  }

  /**
   * Add new metric to the metrics Map.
   * @param peerId
   * @param requestId
   * @param result
   */
  public addMetric(peerId: string, requestId: number, result: Result) {
    let nodeMetrics = this.metrics.get(peerId);
    log.verbose(
      "node: %s, requestId: %s, result: %s",
      peerId,
      requestId,
      result
    );

    if (!nodeMetrics) {
      nodeMetrics = {
        responses: new Map<number, ResponseMetric>(),
        stats: { success: 0, dishonest: 0, failed: 0 },
        sent: 0,
        updatedAt: new Date(),
      };
      this.metrics.set(peerId, nodeMetrics);
    }

    nodeMetrics.responses.set(requestId, {
      createdAt: new Date(),
      result,
    });

    nodeMetrics.sent += 1;
    nodeMetrics.stats = this.getResultsStats(peerId);

    log.verbose(
      "node: %s has a reliability score of %s",
      peerId,
      this.getScore(peerId)
    );

    log.verbose(
      `node: ${peerId.substring(peerId.length - 5)} request number: ${
        this.metrics.get(peerId)?.sent
      } reliability score: ${this.getScore(peerId)}`
    );

    // Remove all responses except those with a dishonest result.
    if (nodeMetrics.sent > this.MAX_RESPONSES) {
      const [lastRequestId, lastResponse] = Array.from(
        nodeMetrics.responses
      ).at(-1) as [number, ResponseMetric];

      for (const [requestId, { result }] of nodeMetrics.responses) {
        if (result !== "dishonest") {
          nodeMetrics.responses.delete(requestId);
        }
      }
      nodeMetrics.responses.set(lastRequestId, lastResponse);

      nodeMetrics.sent = 1;
      nodeMetrics.stats = this.getResultsStats(peerId);
      const updatedScore = this.getScore(peerId);
      this.score.set(peerId, updatedScore);
      log.verbose(
        "node %s exceeded the max number of responses possible. Recalculating score",
        peerId,
        log.createMetric({ peerId: peerId })
      );
      log.verbose(
        `NODE ${peerId} SCORE AFTER RECALCULATION: ${this.getScore(peerId)}`
      );
    }
  }

  /**
   * Get node score.
   * @param peerId
   * @returns peerId score.
   */
  public getScore(peerId: string) {
    if (this.metrics.has(peerId)) {
      const sent = this.metrics.get(peerId)!.sent;
      const dishonest = this.metrics.get(peerId)!.stats.dishonest;
      const failed = this.metrics.get(peerId)!.stats.failed;

      if (dishonest > 0) {
        this.score.set(peerId, 0);
        log.normal(
          "node %s is a dishonest node with 0 reliability score",
          peerId
        );
      } else if (sent < this.FRESH_NODE_THRESHOLD) {
        this.score.set(peerId, FRESH_NODE_SCORE);
        log.normal(
          "node %s is a fresh node with 0.2 reliability score",
          peerId
        );
      } else {
        const score = (sent - failed) / sent;
        this.score.set(peerId, score);
        log.normal("node %s has a %s reliability score", peerId, score);
      }
      return this.score.get(peerId)!;
    } else {
      return FRESH_NODE_SCORE;
    }
  }

  /**
   * Get all node scores.
   * @returns array of objects with peerId and score.
   */
  public getScores() {
    const entries = Array.from(this.metrics);
    return entries.map(([peerId]) => {
      const score = this.getScore(peerId);
      return { peerId, score };
    });
  }

  public getStatus(peerId: string): "FRESH" | "NON_FRESH" {
    const sent = this.metrics.get(peerId)?.sent || 0;
    if (sent < this.FRESH_NODE_THRESHOLD) {
      return "FRESH";
    } else {
      return "NON_FRESH";
    }
  }
}
