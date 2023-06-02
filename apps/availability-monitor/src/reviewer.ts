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
    this.queue = AsyncQueue(review, concurrency);
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
 * Iterates, pulls registered entry nodes,
 * and queues reviews for them.
 * Additionally, updates prometheus with the results.
 */
export default class Reviewer {
  private interval: NodeJS.Timer | undefined;
  private reviewGuage: Gauge;
  protected reviewQueue: ReviewQueue;

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
   */
  public async addPriorityReview(peerId: string): Promise<void> {
    log.verbose("Adding", peerId, "in queue");
    const node = await getRegisteredNode(this.db, peerId).then(fromDbNode);
    this.reviewQueue.addPriority(node, (error, result) => {
      if (!error && result) this.onResult(node, result);
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
        if (!error && result) this.onResult(node, result);
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
