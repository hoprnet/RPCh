import * as DPapi from "./dp-api";
import * as Request from "./request";
import * as Segment from "./segment";
import * as NodeSel from "./node-selector";
import NodePair from "./node-pair";
import { createLogger } from "./utils";

import type { MessageListener } from "./node-pair";
import type { NodeMatch } from "./node-match";

const log = createLogger(["nodes-collector"]);

const NodePairFetchTimeout: number = 10e3; // 10 seconds downtime to avoid repeatedly querying DP
const NodePairAmount: number = 10; // how many routes do we fetch

export default class NodesCollector {
  private readonly nodePairs: Map<string, NodePair> = new Map();
  private lastFetchNodePairs = 0;
  private lastMatchedAt = new Date(0);
  private ongoingFetchPairs = false;

  constructor(
    private readonly discoveryPlatformEndpoint: string,
    private readonly clientId: string,
    private readonly applicationTag: number,
    private readonly messageListener: MessageListener
  ) {
    this.fetchNodePairs();
  }

  public destruct = () => {
    for (const [, np] of this.nodePairs) {
      np.destruct();
    }
    this.nodePairs.clear();
  };

  /**
   * Ready for request receival.
   */
  public ready = async (timeout: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const now = Date.now();
        const elapsed = now - start;
        const res = NodeSel.routePair(this.nodePairs);
        if (res.res === "ok") {
          return resolve(true);
        }
        if (elapsed > timeout) {
          log.error("Timeout waiting for ready", elapsed);
          return reject(`timeout after ${elapsed} ms`);
        }
        setTimeout(check, 100);
      };
      check();
    });
  };

  /**
   * Request primary node pair.
   */
  public requestNodePair = async (timeout: number): Promise<NodeMatch> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const now = Date.now();
        const elapsed = now - start;
        const res = NodeSel.routePair(this.nodePairs);
        if (res.res === "ok") {
          return resolve({
            entryNode: res.entryNode!,
            exitNode: res.exitNode!,
          });
        }
        log.verbose("no exit node ready in primary node pair id");
        if (elapsed > timeout) {
          log.error("Timeout waiting for node pair", elapsed);
          return reject(`timeout after ${elapsed} ms`);
        }
        setTimeout(check, 100);
      };
      check();
    });
  };

  /**
   * Request secondary node pair.
   */
  // public get fallbackNodePair(): NodeMatch | undefined {
  //   if (this.secondaryNodePairId) {
  //     const np = this.nodePairs.get(this.secondaryNodePairId)!;
  //     const res = np.readyExitNode();
  //     if (res.res === "ok") {
  //       return { entryNode: np.entryNode, exitNode: res.exitNode };
  //     }
  //   }
  // }

  public requestStarted = (req: Request.Request) => {
    const np = this.nodePairs.get(req.entryId);
    if (!np) {
      log.error(
        "requestStarted",
        Request.prettyPrint(req),
        "on non existing node pair"
      );
      return;
    }
    np.requestStarted(req);
    log.verbose("requestStarted", Request.prettyPrint(req));
  };

  public requestSucceeded = (req: Request.Request, responseTime: number) => {
    const np = this.nodePairs.get(req.entryId);
    if (!np) {
      log.error(
        "requestSucceeded",
        Request.prettyPrint(req),
        "on non existing node pair"
      );
      return;
    }
    np.requestSucceeded(req, responseTime);
    log.verbose("requestSucceeded", Request.prettyPrint(req));
  };

  public requestFailed = (req: Request.Request) => {
    const np = this.nodePairs.get(req.entryId);
    if (!np) {
      log.error(
        "requestFailed",
        Request.prettyPrint(req),
        "on non exiting node pair"
      );
      return;
    }
    np.requestFailed(req);
    log.verbose("requestFailed", Request.prettyPrint(req));
  };

  public segmentStarted = (req: Request.Request, seg: Segment.Segment) => {
    const np = this.nodePairs.get(req.entryId);
    if (!np) {
      log.error(
        "segmentStarted",
        Segment.prettyPrint(seg),
        "on non existing node pair"
      );
      return;
    }
    np.segmentStarted(seg);
    log.verbose("segmentStarted", Segment.prettyPrint(seg));
  };

  public segmentSucceeded = (
    req: Request.Request,
    seg: Segment.Segment,
    responseTime: number
  ) => {
    const np = this.nodePairs.get(req.entryId);
    if (!np) {
      log.error(
        "segmentSucceeded",
        Segment.prettyPrint(seg),
        "on non existing node pair"
      );
      return;
    }
    np.segmentSucceeded(seg, responseTime);
    log.verbose("segmentSucceeded", Segment.prettyPrint(seg));
  };

  public segmentFailed = (req: Request.Request, seg: Segment.Segment) => {
    const np = this.nodePairs.get(req.entryId);
    if (!np) {
      log.error(
        "segmentFailed",
        Segment.prettyPrint(seg),
        "on non existing node pair"
      );
      return;
    }
    np.segmentFailed(seg);
    log.verbose("segmentFailed", Segment.prettyPrint(seg));
  };

  private fetchNodePairs = () => {
    if (this.ongoingFetchPairs) {
      log.verbose("fetchNodePairs ongoing");
      return;
    }
    const diff = Date.now() - this.lastFetchNodePairs;
    if (diff < NodePairFetchTimeout) {
      log.verbose(
        "fetchNodePairs too early - need to wait",
        NodePairFetchTimeout - diff,
        "ms"
      );
      return;
    }
    this.ongoingFetchPairs = true;

    DPapi.fetchNodes(
      {
        discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
        clientId: this.clientId,
      },
      NodePairAmount,
      this.lastMatchedAt
    )
      .then(this.initNodes)
      .catch((err) => {
        if (err.message === DPapi.NoMoreNodes) {
          log.info("No node pairs available");
        } else {
          log.error("Error fetching nodes", err);
        }
      })
      .finally(() => {
        this.lastFetchNodePairs = Date.now();
        this.ongoingFetchPairs = false;
      });
  };

  private initNodes = (nodes: DPapi.Nodes) => {
    const lookupExitNodes = new Map(nodes.exitNodes.map((x) => [x.id, x]));
    nodes.entryNodes
      .filter((en) => !this.nodePairs.has(en.id))
      .forEach((en) => {
        const exitNodes = en.recommendedExits.map(
          (id) => lookupExitNodes.get(id)!
        );
        const np = new NodePair(
          en,
          exitNodes,
          this.applicationTag,
          this.messageListener
        );
        this.nodePairs.set(np.id, np);
      });

    // reping all nodes
    this.nodePairs.forEach((np) => np.ping());
  };
}
