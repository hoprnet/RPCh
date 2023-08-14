import { MessageEvent } from "isomorphic-ws";
import { utils } from "ethers";

import * as EntryNode from "./entry-node";
import * as ExitNode from "./exit-node";
import * as NodesAPI from "./nodes-api";
import NodePair from "./node-pair";
import type { Request } from "./request";
import { createLogger, shortPeerId } from "./utils";

import type { NodeMatch } from "./node-match";

const log = createLogger(["nodes-collector"]);

export default class NodesCollector {
  private readonly nodePairs: Map<string, NodePair> = new Map();
  private timerFetchPairs = setTimeout(function () {});
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

  public stop = () => {
    log.verbose("stopping");
    for (const [, np] of this.nodePairs) {
      np.close();
    }
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
        }
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
      log.error("requestStarted", req, "on non exiting node pair");
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
      log.error("requestSucceeded", req, "on non exiting node pair");
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
    this.closeOthers();
  };

  public requestFailed = ({ entryId, exitId, id }: Request) => {
    const np = this.nodePairs.get(entryId);
    const req = `${id}:${shortPeerId(entryId)}>${shortPeerId(exitId)}`;
    if (!np) {
      log.error("requestSucceeded", req, "on non exiting node pair");
      return;
    }
    const res = np.requestFailed(exitId);
    log.verbose("requestFailed", req, "-", res, "failed on that route");
    this.updatePairIds();
  };

  private fetchNodePairs = async () => {
    clearTimeout(this.timerFetchPairs);
    if (this.ongoingFetchPairs) {
      return;
    }
    if (this.nodePairs.size >= NodePair.TargetAmount) {
      this.timerFetchPairs = setTimeout(this.fetchNodePairs, 60e3);
      return;
    }
    this.ongoingFetchPairs = true;

    const rawEntryNodes: NodesAPI.RawEntryNode[] = [];
    const excludeList: string[] = [];
    let noError = true;
    while (rawEntryNodes.length < NodePair.TargetAmount && noError) {
      const rawNode: NodesAPI.RawEntryNode | void =
        await NodesAPI.fetchEntryNode({
          excludeList,
          discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
          clientId: this.clientId,
        }).catch((err) => {
          if (err.message !== NodesAPI.NoMoreNodes) {
            log.error("Error fetching entry nodes", err);
          }
          noError = false;
        });
      if (rawNode) {
        excludeList.push(rawNode.id);
        const nodeInfo = await NodesAPI.fetchNode(
          {
            discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
            clientId: this.clientId,
          },
          rawNode.id
        );
        if (nodeInfo && !nodeInfo.node.has_exit_node) {
          // only use entry only nodes here
          rawEntryNodes.push(rawNode);
        }
      }
    }

    NodesAPI.fetchExitNodes({
      discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
      clientId: this.clientId,
    })
      .then((rawExitNodes: NodesAPI.RawExitNode[]) => {
        const exitNodes = rawExitNodes.map(ExitNode.fromRaw);
        const entryNodes = rawEntryNodes.map(EntryNode.fromRaw);
        this.initNodes(entryNodes, exitNodes);
      })
      .catch((err: any) => {
        log.error("Error fetching exit nodes", err);
      })
      .finally(() => {
        this.ongoingFetchPairs = false;
        this.timerFetchPairs = setTimeout(this.fetchNodePairs, 60e3);
      });
  };

  private initNodes = (
    entryNodes: Iterable<EntryNode.EntryNode>,
    exitNodes: Iterable<ExitNode.ExitNode>
  ) => {
    const newNodePairs = Array.from(entryNodes)
      .filter((en) => !this.nodePairs.has(en.peerId))
      .map((en) => new NodePair(en, exitNodes));
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
    }>(
      (acc, np) => {
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
      },
      {
        prim: this.nodePairs.get(this.primaryNodePairId || ""),
        sec: this.nodePairs.get(this.secondaryNodePairId || ""),
      }
    );
    if (prim) {
      this.primaryNodePairId = prim.id;
    }
    if (sec) {
      this.secondaryNodePairId = sec.id;
    }
  };

  private closeOthers = () => {
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

  private messageListener = (event: MessageEvent) => {
    const body = event.data.toString();
    // message received is an acknowledgement of a
    // message we have send, we can safely ignore this
    if (body.startsWith("ack:")) {
      return;
    }

    let msg: string | undefined;
    try {
      msg = utils.toUtf8String(
        utils.RLP.decode(new Uint8Array(JSON.parse(`[${body}]`)))[0]
      );
    } catch (error) {
      log.error("Error decoding message:", error);
      return;
    }
    this.onWSmessage(msg);
  };
}
