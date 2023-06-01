import { queue as AsyncQueue, QueueObject } from "async";
import review from "./review";
import {
  type DBInstance,
  type RegisteredNode,
  getRegisteredNodes,
  getRegisteredNode,
} from "./db";
import { createLogger } from "./utils";

const log = createLogger(["reviewer"]);

/**
 * Queue for multiple node reviews at a time.
 */
export class ReviewQueue {
  public readonly queue: QueueObject<any>;

  constructor(concurrency: number) {
    this.queue = AsyncQueue(review, concurrency);
  }

  public addPriority(node: RegisteredNode): void {
    this.queue.unshift(node);
  }

  public add(node: RegisteredNode): void {
    this.queue.push(node);
  }

  public stop() {
    this.queue.kill();
  }
}

export default class Reviewer {
  private interval: NodeJS.Timer | undefined;
  protected reviewQueue: ReviewQueue;

  constructor(
    private db: DBInstance,
    private frequency: number,
    concurrency: number
  ) {
    this.reviewQueue = new ReviewQueue(concurrency);
  }

  public async addReview(peerId: string): Promise<void> {
    log.verbose("Adding", peerId, "in queue");
    const node = await getRegisteredNode(this.db, peerId);
    this.reviewQueue.addPriority({
      hasExitNode: node.has_exit_node,
      peerId: node.id,
      chainId: node.chain_id,
      hoprdApiEndpoint: node.hoprd_api_endpoint,
      hoprdApiToken: node.hoprd_api_token,
      exitNodePubKey: node.exit_node_pub_key,
      nativeAddress: node.native_address,
    });
  }

  private async addReviews(): Promise<void> {
    if (this.reviewQueue.queue.length() > 0) {
      log.verbose("Queue already running, not adding new nodes in queue");
      return;
    }

    const nodes = await getRegisteredNodes(this.db, { status: "READY" });
    log.verbose("Adding %i nodes in queue", nodes.length);
    for (const node of nodes) {
      this.reviewQueue.add({
        hasExitNode: node.has_exit_node,
        peerId: node.id,
        chainId: node.chain_id,
        hoprdApiEndpoint: node.hoprd_api_endpoint,
        hoprdApiToken: node.hoprd_api_token,
        exitNodePubKey: node.exit_node_pub_key,
        nativeAddress: node.native_address,
      });
    }
  }

  public start() {
    log.normal("Started reviewer");
    this.interval = setInterval(() => this.addReviews(), this.frequency);
  }

  public stop() {
    log.normal("Stopped reviewer");
    clearInterval(this.interval);
    this.reviewQueue.stop();
  }
}
