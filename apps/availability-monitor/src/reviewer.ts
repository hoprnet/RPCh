import type { Gauge } from "prom-client";
import { queue as AsyncQueue, QueueObject } from "async";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import review, { type Result } from "./review";
import {
  type DBInstance,
  type RegisteredNode,
  getRegisteredNodes,
  getRegisteredNode,
} from "./db";
import { createLogger, fromDbNode } from "./utils";
import { callbackify } from "util";

const log = createLogger(["reviewer"]);

/**
 * Queue for multiple node reviews at a time.
 */
export class ReviewQueue {
  public readonly queue: QueueObject<any>;

  constructor(concurrency: number) {
    this.queue = AsyncQueue(callbackify(review), concurrency);
  }

  public addPriority(
    node: RegisteredNode,
    cb: (error: any, result?: Result) => void
  ): void {
    this.queue.unshift<Result, any>(node, cb);
  }

  public add(
    node: RegisteredNode,
    cb: (error: any, result?: Result) => void
  ): void {
    this.queue.push<Result, any>(node, cb);
  }

  public stop() {
    this.queue.kill();
  }
}

/**
 * Pulls registered nodes,
 * and queues reviews for them.
 * Additionally, updates prometheus with the results.
 */
export default class Reviewer {
  private interval: NodeJS.Timer | undefined;
  private stabilityGuage: Gauge;
  private reviewQueue: ReviewQueue;
  public readonly results: Map<string, Result> = new Map();

  /**
   * @param db
   * @param metricManager
   * @param intervalMs how often should we try to queue nodes to be reviewed
   * @param concurrency how many nodes to review in parallel
   */
  constructor(
    private db: DBInstance,
    metricManager: MetricManager,
    private intervalMs: number,
    concurrency: number
  ) {
    this.reviewQueue = new ReviewQueue(concurrency);
    this.stabilityGuage = metricManager.createGauge(
      "stability",
      "whether a node is stable",
      {
        labelNames: ["peer_id"],
      }
    );
  }

  /**
   * Called whenever we have a new review result.
   * @param node
   * @param result
   */
  private onResult(node: RegisteredNode, result: Result): void {
    this.results.set(node.peerId, result);
    this.stabilityGuage.set(
      {
        peer_id: node.peerId,
      },
      Number(result.isStable)
    );
  }

  /**
   * Add node to be reviewed as soon as possible.
   * @param peerId
   * @returns the review result of the node
   */
  public async addPriorityReview(peerId: string): Promise<Result> {
    return new Promise(async (resolve, reject) => {
      try {
        log.verbose("Adding", peerId, "in queue");
        const node = await getRegisteredNode(this.db, peerId).then(fromDbNode);
        this.reviewQueue.addPriority(node, (error, result) => {
          if (error || !result) {
            log.verbose("Failed to review", peerId, error || result);
            reject(error);
          } else {
            this.onResult(node, result);
            resolve(result);
          }
        });
      } catch (error) {
        log.verbose("Failed to addPriorityReview", peerId, error);
        reject(error);
      }
    });
  }

  /** Adds all registered nodes to queue review. */
  private async addReviews(): Promise<void> {
    if (this.reviewQueue.queue.length() > 0) {
      log.verbose("Queue already running, not adding new nodes in queue");
      return;
    }

    const nodes = await getRegisteredNodes(this.db, { status: "READY" });
    log.verbose("Adding %i nodes in queue", nodes.length);
    for (const dbNode of nodes) {
      const node = fromDbNode(dbNode);
      this.reviewQueue.add(node, (error, result) => {
        if (error || !result) {
          log.verbose("Failed to review", node.peerId, error || result);
        } else {
          this.onResult(node, result);
        }
      });
    }
  }

  /** Start reviewer. */
  public start() {
    log.normal("Started reviewer");
    this.interval = setInterval(() => this.addReviews(), this.intervalMs);
  }

  /** Stop reviewer. */
  public stop() {
    log.normal("Stopped reviewer");
    clearInterval(this.interval);
    this.reviewQueue.stop();
  }
}
