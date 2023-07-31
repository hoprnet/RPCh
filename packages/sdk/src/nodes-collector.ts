import { type onEventParameterType } from "@rpch/common";

import type { Request } from "./request";
import * as Nodes from "./nodes";
import * as NodesAPI from "./nodes-api";
import { createLogger } from "./utils";

const log = createLogger(["nodes-collector"]);

export default class NodesCollector {
  private readonly nodes: Nodes.Nodes = Nodes.init();
  private actTimer: ReturnType<typeof setTimeout> = setTimeout(function () {});

  constructor(
    private readonly discoveryPlatformEndpoint: string,
    private readonly clientId: string,
    private readonly onWSmessage: (message: string) => void
  ) {}

  public stop = () => {};

  /**
   * Ready for request receival, no websocket yet.
   */
  public ready = async (timeout: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const now = Date.now();
        const elapsed = now - start;
        const cmd = Nodes.reachReady(this.nodes);
        if (cmd.label === Nodes.CommandLabel.None) {
          return resolve(true);
        }
        this.actOnCmd(cmd);
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
   * Requested node pair, needs websocket.
   */
  public requestNodePair = async (timeout: number): Promise<Nodes.Pair> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const now = Date.now();
        const elapsed = now - start;
        const { cmd, nodePair } = Nodes.reachNodePair(this.nodes);
        if (nodePair) {
          return resolve(nodePair);
        }
        this.actOnCmd(cmd);
        if (elapsed > timeout) {
          log.error("Timeout waiting for node pair", elapsed);
          return reject(`timeout after ${elapsed} ms`);
        }
        setTimeout(check, 100);
      };
      check();
    });
  };

  public requestStarted = ({ entryId, exitId, id }: Request) => {
    const res = Nodes.requestStarted(this.nodes, { entryId, exitId }, id);
    this.actOnCmd(res);
  };

  public requestSucceeded = (
    { entryId, exitId, id }: Request,
    responseTime: number
  ) => {
    const res = Nodes.requestSucceeded(
      this.nodes,
      { entryId, exitId },
      id,
      responseTime
    );
    this.actOnCmd(res);
  };

  public requestFailed = ({ entryId, exitId, id }: Request) => {
    const res = Nodes.requestFailed(this.nodes, { entryId, exitId }, id);
    this.actOnCmd(res);
  };

  private actOnCmd = (cmd: Nodes.Command) => {
    clearTimeout(this.actTimer);
    switch (cmd.label) {
      case Nodes.CommandLabel.NeedEntryNode:
        this.fetchEntryNode(cmd.excludeIds);
        break;
      case Nodes.CommandLabel.NeedExitNode:
        this.fetchExitNodes();
        break;
      case Nodes.CommandLabel.OpenWebSocket:
        this.openWebSocket(cmd.entryNode);
        break;
      case Nodes.CommandLabel.CloseWebSocket:
        this.closeWebSocket(cmd.entryNode);
        break;
      default:
        break;
    }
  };

  private fetchEntryNode = (excludeIds: string[]) => {
    NodesAPI.fetchEntryNode({
      excludeList: excludeIds,
      discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
      clientId: this.clientId,
    })
      .then(this.onEntryNode)
      .catch(this.onEntryNodeError);
  };

  private onEntryNode = (entryNode: Nodes.EntryNode) => {
    Nodes.newEntryNode(this.nodes, entryNode);
  };

  private onEntryNodeError = (err: string) => {
    log.error("Error requesting entry node", err);
    setTimeout(() => {
      const res = Nodes.reachReady(this.nodes);
      this.actOnCmd(res);
    }, 555);
  };

  private fetchExitNodes = () => {
    NodesAPI.fetchExitNodes({
      discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
      clientId: this.clientId,
    })
      .then(this.onExitNodes)
      .catch(this.onExitNodesError);
  };

  private onExitNodes = (exitNodes: Nodes.ExitNode[]) => {
    Nodes.addExitNodes(this.nodes, exitNodes);
  };

  private onExitNodesError = (err: string) => {
    log.error("Error requesting exit nodes", err);
    setTimeout(() => {
      const res = Nodes.reachReady(this.nodes);
      this.actOnCmd(res);
    }, 555);
  };

  private openWebSocket = (entryNode: Nodes.EntryNode) => {
    const wsConn = NodesAPI.openWebSocket(
      entryNode,
      (evt: onEventParameterType) => {
        switch (evt.action) {
          case "message":
            this.onWSmessage(evt.message);
            break;
          default:
            Nodes.onWSevt(this.nodes, entryNode, evt);
            break;
        }
      }
    );
    Nodes.addWSconn(this.nodes, entryNode, wsConn);
  };

  private closeWebSocket = (entryNode: Nodes.EntryNode) => {
    entryNode.wsConn?.close();
  };
}
