import type { Gauge } from "prom-client";
import { queue as AsyncQueue, QueueObject } from "async";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import review, { type Result, listOfChecks } from "./review";
import {
  type DBInstance,
  type RegisteredNode,
  getRegisteredNodes,
  getRegisteredNode,
} from "./db";
import { createLogger, fromDbNode } from "./utils";
import { callbackify } from "util";

const log = createLogger(["reviewer"]);

/** Labels to be used in metrics */
const REVIEW_METRIC_NAME = "guage_review_result";
const REVIEW_METRIC_HELP = "whether a node is considered stable";
const REVIEW_METRIC_LABELS = [
  "peerId",
  "hasExitNode",
  ...listOfChecks.map((str) => (str += "Passed")),
  ...listOfChecks.map((str) => (str += "Value")),
  ...listOfChecks.map((str) => (str += "Error")),
];

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
    this.queue.push<Result, any>(node, (error, result) => {
      log.verbose("FINIOSHED", error, result);
      cb(error, result);
    });
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
  private reviewGuage: Gauge;
  private reviewQueue: ReviewQueue;
  public readonly results: Map<string, Result> = new Map();

  /**
   * @param db
   * @param metricManager
   * @param frequency how often should we try to queue nodes to be reviewed
   * @param concurrency how many nodes to review in parallel
   */
  constructor(
    private db: DBInstance,
    metricManager: MetricManager,
    private frequency: number,
    concurrency: number
  ) {
    this.reviewQueue = new ReviewQueue(concurrency);
    this.reviewGuage = metricManager.createGauge(
      REVIEW_METRIC_NAME,
      REVIEW_METRIC_HELP,
      {
        name: REVIEW_METRIC_NAME,
        help: REVIEW_METRIC_HELP,
        labelNames: REVIEW_METRIC_LABELS,
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
    this.reviewGuage.set(
      {
        peerId: node.peerId,
        hasExitNode: Number(node.hasExitNode),
        hoprdVersionPassed: Number(result.hoprdVersion.passed),
        hoprdVersionValue: String(result.hoprdVersion.value),
        hoprdVersionError: String(result.hoprdVersion.error),
        hoprdHealthPassed: Number(result.hoprdHealth.passed),
        hoprdHealthValue: String(result.hoprdHealth.value),
        hoprdHealthError: String(result.hoprdHealth.error),
        hoprdWorkingApiEndpointPassed: Number(
          result.hoprdWorkingApiEndpoint.passed
        ),
        hoprdWorkingApiEndpointValue: String(
          result.hoprdWorkingApiEndpoint.value
        ),
        hoprdWorkingApiEndpointError: String(
          result.hoprdWorkingApiEndpoint.error
        ),
        hoprdSSLPassed: Number(result.hoprdSSL.passed),
        hoprdSSLValue: String(result.hoprdSSL.value),
        hoprdSSLError: String(result.hoprdSSL.error),
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
    this.interval = setInterval(() => this.addReviews(), this.frequency);
  }

  /** Stop reviewer. */
  public stop() {
    log.normal("Stopped reviewer");
    clearInterval(this.interval);
    this.reviewQueue.stop();
  }
}
