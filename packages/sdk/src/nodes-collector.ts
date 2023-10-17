import * as DPapi from "./dp-api";
import * as Request from "./request";
import * as Segment from "./segment";
import * as NodeSel from "./node-selector";
import * as NodePair from "./node-pair";
import { createLogger } from "./utils";

import type { MessageListener } from "./node-pair";
import type { EntryNode } from "./entry-node";
import type { NodeMatch } from "./node-match";

const log = createLogger(["nodes-collector"]);

const NodePairFetchTimeout: number = 10e3; // 10 seconds downtime to avoid repeatedly querying DP
const NodePairAmount: number = 10; // how many routes do we fetch

export default class NodesCollector {
  private readonly nodePairs: Map<string, NodePair.NodePair> = new Map();
  private lastFetchNodePairs = 0;
  private lastMatchedAt = new Date(0);
  private ongoingFetchPairs = false;

  constructor(
    private readonly discoveryPlatformEndpoint: string,
    private readonly clientId: string,
    private readonly forceZeroHop: boolean,
    private readonly applicationTag: number,
    private readonly messageListener: MessageListener
  ) {
    this.fetchNodePairs();
  }

  public destruct = () => {
    for (const np of this.nodePairs.values()) {
      NodePair.destruct(np);
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
        if (NodeSel.isOk(res)) {
          log.verbose("ready with route pair", NodeSel.prettyPrint(res));
          return resolve(true);
        }
        if (elapsed > timeout) {
          log.error("Timeout waiting for ready", elapsed, res.error);
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
        if (NodeSel.isOk(res)) {
          log.verbose("found route pair", NodeSel.prettyPrint(res));
          return resolve(res.match);
        }
        if (elapsed > timeout) {
          log.error("Timeout waiting for node pair", elapsed, res.error);
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
  public fallbackNodePair = (exclude: EntryNode): NodeMatch | undefined => {
    const res = NodeSel.fallbackRoutePair(this.nodePairs, exclude);
    if (NodeSel.isOk(res)) {
      log.verbose("found fallback route pair", NodeSel.prettyPrint(res));
      return res.match;
    }
  };

  public requestStarted = (req: Request.Request) => {
    const np = this.nodePairs.get(req.entryPeerId);
    if (!np) {
      log.error(
        "requestStarted",
        Request.prettyPrint(req),
        "on non existing node pair"
      );
      return;
    }
    NodePair.requestStarted(np, req);
    log.verbose(
      "requestStarted",
      Request.prettyPrint(req),
      NodePair.prettyPrint(np)
    );
  };

  public requestSucceeded = (req: Request.Request, responseTime: number) => {
    const np = this.nodePairs.get(req.entryPeerId);
    if (!np) {
      log.error(
        "requestSucceeded",
        Request.prettyPrint(req),
        "on non existing node pair"
      );
      return;
    }
    NodePair.requestSucceeded(np, req, responseTime);
    log.verbose(
      "requestSucceeded",
      Request.prettyPrint(req),
      NodePair.prettyPrint(np)
    );
  };

  public requestFailed = (req: Request.Request) => {
    const np = this.nodePairs.get(req.entryPeerId);
    if (!np) {
      log.error(
        "requestFailed",
        Request.prettyPrint(req),
        "on non exiting node pair"
      );
      return;
    }
    NodePair.requestFailed(np, req);
    log.verbose(
      "requestFailed",
      Request.prettyPrint(req),
      NodePair.prettyPrint(np)
    );
  };

  public segmentStarted = (req: Request.Request, seg: Segment.Segment) => {
    const np = this.nodePairs.get(req.entryPeerId);
    if (!np) {
      log.error(
        "segmentStarted",
        Segment.prettyPrint(seg),
        "on non existing node pair"
      );
      return;
    }
    NodePair.segmentStarted(np, seg);
    log.verbose(
      "segmentStarted",
      Segment.prettyPrint(seg),
      NodePair.prettyPrint(np)
    );
  };

  public segmentSucceeded = (
    req: Request.Request,
    seg: Segment.Segment,
    responseTime: number
  ) => {
    const np = this.nodePairs.get(req.entryPeerId);
    if (!np) {
      log.error(
        "segmentSucceeded",
        Segment.prettyPrint(seg),
        "on non existing node pair"
      );
      return;
    }
    NodePair.segmentSucceeded(np, seg, responseTime);
    log.verbose(
      "segmentSucceeded",
      Segment.prettyPrint(seg),
      NodePair.prettyPrint(np)
    );
  };

  public segmentFailed = (req: Request.Request, seg: Segment.Segment) => {
    const np = this.nodePairs.get(req.entryPeerId);
    if (!np) {
      log.error(
        "segmentFailed",
        Segment.prettyPrint(seg),
        "on non existing node pair"
      );
      return;
    }
    NodePair.segmentFailed(np, seg);
    log.verbose(
      "segmentFailed",
      Segment.prettyPrint(seg),
      NodePair.prettyPrint(np)
    );
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
        forceZeroHop: this.forceZeroHop,
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
        const np = NodePair.create(
          en,
          exitNodes,
          this.applicationTag,
          this.messageListener
        );
        this.nodePairs.set(NodePair.id(np), np);
      });

    // reping all nodes
    this.nodePairs.forEach((np) => NodePair.ping(np));
  };
}
