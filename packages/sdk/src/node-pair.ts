import { WebSocket } from "isomorphic-ws";

import * as NodesAPI from "./nodes-api";
import { createLogger, shortPeerId } from "./utils";

import type { EntryNode, ExitNode } from "./nodes";

type InternalState =
  | { s: "init" }
  | { s: "connect"; t: number }
  | { s: "open" };

export default class NodePair {
  public static TargetAmount = 10;

  private socket?: WebSocket;
  private connectTime?: number;
  private internalState: InternalState = { s: "init" };
  private readonly log;
  private readonly exitNodes: Map<string, ExitNode> = new Map();

  constructor(public readonly entryNode: EntryNode) {
    const id = shortPeerId(entryNode.peerId);
    this.log = createLogger([`nodepair-${id}`]);
  }

  public get id() {
    return this.entryNode.peerId;
  }

  public addExitNodes = (exitNodes: Iterable<ExitNode>) => {
    for (const n of exitNodes) {
      this.exitNodes.set(n.peerId, n);
    }
  };

  public connect = () => {
    this.socket = NodesAPI.connectWS(this.entryNode);
    this.internalState = { s: "connect", t: Date.now() };
    this.socket.on("open", this.onWSopen);
    this.socket.on("error", this.onWSerror);
    this.socket.on("close", this.onWSclose);
  };

  public close = () => {
    this.socket?.close();
  };

  private onWSopen = () => {
    this.log.verbose("onWSopen", JSON.stringify(this.internalState));
    if (this.internalState.s === "connect") {
      this.connectTime = Date.now() - this.internalState.t;
      this.internalState = { s: "open" };
    }
  };

  private onWSerror = (err: any) => {
    this.log.error("onWSerror", err, JSON.stringify(this.internalState));
  };

  private onWSclose = (evt: any) => {
    this.log.info("onWSclose", evt, JSON.stringify(this.internalState));
  };
}
