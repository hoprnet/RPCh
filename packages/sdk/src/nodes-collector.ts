import { CloseEvent, MessageEvent } from "isomorphic-ws";
import { utils } from "ethers";

import * as EntryNode from "./entry-node";
import * as ExitNode from "./exit-node";
import * as DPapi from "./dp-api";
import NodePair from "./node-pair";
import type { Request } from "./request";
import { createLogger, shortPeerId } from "./utils";

import type { NodeMatch } from "./node-match";

const log = createLogger(["nodes-collector"]);

const NodePairFetchTimeout: number = 60e3; // 1 minute downtime to avoid repeatedly querying DP

export default class NodesCollector {
  private readonly nodePairs: Map<string, NodePair> = new Map();
  private lastFetchNodePairs = 0;
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
          this.updatePairIds();
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

  private fetchNodePairs = async () => {
    if (this.ongoingFetchPairs) {
      return;
    }
    if (Date.now() - this.lastFetchNodePairs < NodePairFetchTimeout) {
      return;
    }
    this.ongoingFetchPairs = true;

    const rawEntryNodes: DPapi.RawEntryNode[] = [];
    const excludeList: string[] = [];
    let noError = true;
    while (rawEntryNodes.length < NodePair.TargetAmount && noError) {
      const rawNode: DPapi.RawEntryNode | void = await DPapi.fetchEntryNode({
        excludeList,
        discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
        clientId: this.clientId,
      }).catch((err) => {
        if (err.message !== DPapi.NoMoreNodes) {
          log.error("Error fetching entry nodes", err);
        }
        noError = false;
      });
      if (rawNode) {
        excludeList.push(rawNode.id);
        rawEntryNodes.push(rawNode);
      }
    }

    // if we have distinct entry nodes, use those
    const prNodeResults = rawEntryNodes.map((re) =>
      DPapi.fetchNode(
        {
          discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
          clientId: this.clientId,
        },
        re.id
      )
    );
    const nodeResults = await Promise.allSettled(prNodeResults);
    const rawEntriesNoExits = rawEntryNodes.filter((re) => {
      return !!nodeResults.find((r) => {
        if ("value" in r) {
          const node = r.value.node;
          if (node.id === re.id) {
            return !node.has_exit_node;
          }
        }
        return false;
      });
    });
    const prefRawEntries =
      rawEntriesNoExits.length > 0 ? rawEntriesNoExits : rawEntryNodes;

    // fetch exit nodes
    DPapi.fetchExitNodes({
      discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
      clientId: this.clientId,
    })
      .then((rawExitNodes: DPapi.RawExitNode[]) => {
        const exitNodes = rawExitNodes.map(ExitNode.fromRaw);
        const entryNodes = prefRawEntries.map(EntryNode.fromRaw);
        this.initNodes(entryNodes, exitNodes);
      })
      .catch((err: any) => {
        log.error("Error fetching exit nodes", err);
      })
      .finally(() => {
        this.lastFetchNodePairs = Date.now();
        this.ongoingFetchPairs = false;
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
