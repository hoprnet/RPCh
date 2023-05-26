import { queue as AsyncQueue, QueueObject } from "async";
import review from "./review";
import { type DBInstance, type RegisteredNode, getRegisteredNodes } from "./db";

/**
 * Queue for multiple reviews the same time.
 */
export class ReviewQueue {
  private queue: QueueObject<any>;

  constructor() {
    // @TODO: pass concurrency
    this.queue = AsyncQueue(review, 5);
  }

  public add(node: RegisteredNode): void {
    this.queue.push(node);
  }

  public stop() {
    this.queue.kill();
  }
}

export default class Reviewer {
  private queue: QueueObject<any>;
  private reviewQueue: ReviewQueue | undefined;

  constructor() {
    this.queue = AsyncQueue(this.worker.bind(this), 1);
  }

  private async worker(db: DBInstance) {
    // fetch nodes
    const nodes = await getRegisteredNodes(db, { status: "READY" });
    this.reviewQueue = new ReviewQueue();

    for (const node of nodes) {
      this.reviewQueue.add(node);
    }
  }

  public add(db: DBInstance): void {
    this.queue.push(db);
  }

  public stop() {
    if (this.reviewQueue) this.reviewQueue.stop();
    this.queue.kill();
  }
}
