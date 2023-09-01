import { CloseEvent, MessageEvent } from "isomorphic-ws";

import * as DPapi from "./dp-api";
import NodePair from "./node-pair";
import type { Request } from "./request";
import { createLogger, shortPeerId } from "./utils";

import type { NodeMatch } from "./node-match";

const log = createLogger(["nodes-collector"]);

const NodePairFetchTimeout: number = 10e3; // 10 seconds downtime to avoid repeatedly querying DP
const NodePairAmount: number = 10; // how many routes do we fetch

export default class NodesCollector {
  private readonly nodePairs: Map<string, NodePair> = new Map();
  private lastFetchNodePairs = 0;
  private lastMatchedAt = new Date(0);
  private ongoingFetchPairs = false;
  private primaryNodePairId?: string;
  private secondaryNodePairId?: string;

  constructor(
    private readonly discoveryPlatformEndpoint: string,
    private readonly clientId: string,
    private readonly onWSmessage: (message: string) => void
  ) {
    this.fetchNodePairs();
  }

  public destruct = () => {
    for (const [, np] of this.nodePairs) {
      np.close();
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
        if (this.primaryNodePairId) {
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
        if (this.primaryNodePairId) {
          const np = this.nodePairs.get(this.primaryNodePairId)!;
          const res = np.readyExitNode();
          if (res.res === "ok") {
            return resolve({ entryNode: np.entryNode, exitNode: res.exitNode });
          }
          log.verbose("no exit node ready in primary node pair id");
        }
        this.updatePairIds();
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
  public get fallbackNodePair(): NodeMatch | undefined {
    if (this.secondaryNodePairId) {
      const np = this.nodePairs.get(this.secondaryNodePairId)!;
      const res = np.readyExitNode();
      if (res.res === "ok") {
        return { entryNode: np.entryNode, exitNode: res.exitNode };
      }
    }
  }

  public requestStarted = ({ entryId, exitId, id }: Request) => {
    const np = this.nodePairs.get(entryId);
    const req = `${id}:${shortPeerId(entryId)}>${shortPeerId(exitId)}`;
    if (!np) {
      log.error("requestStarted", req, "on non existing node pair");
      return;
    }
    np.messageListener = this.messageListener;
    const res = np.requestStarted(exitId);
    log.verbose(
      "requestStarted",
      req,
      "-",
      res,
      "ongoing requests on that route"
    );
  };

  public requestSucceeded = (
    { entryId, exitId, id }: Request,
    responseTime: number
  ) => {
    const np = this.nodePairs.get(entryId);
    const req = `${id}:${shortPeerId(entryId)}>${shortPeerId(exitId)}`;
    if (!np) {
      log.error("requestSucceeded", req, "on non existing node pair");
      return;
    }
    const res = np.requestSucceeded(exitId, responseTime);
    log.verbose(
      "requestSucceeded",
      req,
      "-",
      res,
      "total successes on that route"
    );
    this.closeRedundant();
    // check closure
    if (np.readyExitNode().res === "error" && !np.hasOngoing()) {
      log.info(
        "no more eligible exit nodes after successful request",
        np.prettyPrint()
      );
      np.close();
      this.nodePairs.delete(np.id);
      this.updatePairIds();
    }
  };

  public requestFailed = ({ entryId, exitId, id }: Request) => {
    const np = this.nodePairs.get(entryId);
    const req = `${id}:${shortPeerId(entryId)}>${shortPeerId(exitId)}`;
    if (!np) {
      log.error("requestFailed", req, "on non exiting node pair");
      return;
    }
    const res = np.requestFailed(exitId);
    log.verbose("requestFailed", req, "-", res, "failed on that route");
    // check closure
    if (np.readyExitNode().res === "error" && !np.hasOngoing()) {
      log.info(
        "no more eligible exit nodes after failed request",
        np.prettyPrint()
      );
      np.close();
      this.nodePairs.delete(np.id);
      this.updatePairIds();
    }
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
    const newNodePairs = nodes.entryNodes
      .filter((en) => !this.nodePairs.has(en.id))
      .map((en) => {
        const exitNodes = en.recommendedExits.map(
          (id) => lookupExitNodes.get(id)!
        );
        return new NodePair(en, exitNodes);
      });
    newNodePairs.forEach((np) => {
      np.connect({
        onOpen: this.onOpenWS,
        onClose: this.onCloseWS,
        onError: this.onErrorWS,
      });
      this.nodePairs.set(np.id, np);
    });
  };

  private onOpenWS = (_id: string, _connTime: number) => {
    this.updatePairIds();
  };

  private onCloseWS = (id: string, _evt: CloseEvent) => {
    const np = this.nodePairs.get(id)!;
    log.info("server close event removing node pair", np.prettyPrint());
    np.close();
    this.nodePairs.delete(id);
    this.updatePairIds();
  };

  private onErrorWS = (id: string, _evt: Error) => {
    const np = this.nodePairs.get(id)!;
    log.info("server error event removing node pair", np.prettyPrint());
    np.close();
    this.nodePairs.delete(id);
    this.updatePairIds();
  };

  private updatePairIds = () => {
    const { prim, sec } = Array.from(this.nodePairs.values()).reduce<{
      prim?: NodePair;
      sec?: NodePair;
    }>((acc, np) => {
      if (!np.connectTime) {
        return acc;
      }
      // does not have a valid exit node
      const res = np.readyExitNode();
      if (res.res !== "ok") {
        return acc;
      }
      if (!acc.prim) {
        return { prim: np };
      }
      if (np.connectTime < acc.prim.connectTime!) {
        return { prim: np, sec: acc.prim };
      }
      if (!acc.sec) {
        return { prim: acc.prim, sec: np };
      }
      if (np.connectTime < acc.sec.connectTime!) {
        return { prim: acc.prim, sec: np };
      }
      return acc;
    }, {});
    this.primaryNodePairId = prim?.id;
    this.secondaryNodePairId = sec?.id;
    log.verbose(
      "update to pairIds ",
      this.primaryNodePairId ? shortPeerId(this.primaryNodePairId) : "noprim",
      this.secondaryNodePairId ? shortPeerId(this.secondaryNodePairId) : "nosec"
    );
    if (!this.primaryNodePairId || !this.secondaryNodePairId) {
      // fetch new nodes
      this.fetchNodePairs();
    }
  };

  private closeRedundant = () => {
    const closable = Array.from(this.nodePairs.values()).filter(
      (np) =>
        !(
          np.id === this.primaryNodePairId ||
          np.id === this.secondaryNodePairId ||
          np.hasOngoing()
        )
    );
    log.verbose(`closing ${closable.length} node pairs`);
    closable.forEach((c) => {
      c.close();
      this.nodePairs.delete(c.id);
    });
  };

  private messageListener = (evt: MessageEvent) => {
    const msg = JSON.parse(evt.data.toString());
    // ignore msg-ack for now
    if (msg.type === "message-ack") {
      return;
    }
    this.onWSmessage(msg.body);
  };
}
