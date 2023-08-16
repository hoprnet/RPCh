import { WebSocket, MessageEvent, CloseEvent } from "isomorphic-ws";

import * as NodesAPI from "./nodes-api";
import { average, createLogger, randomEl, shortPeerId } from "./utils";

import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

export type WebSocketCallback = {
  onOpen: (id: string, connTime: number) => void;
  onClose: (id: string, evt: CloseEvent) => void;
  onError: (id: string, err: Error) => void;
};

type ExitData = {
  failedRequests: number;
  latencies: number[];
  ongoingRequests: number;
  successfulRequests: number;
};

export default class NodePair {
  /**
   * Behavioral parameters of the node selection.
   */
  public static TargetAmount = 10;
  private static KeepLastLatencies = 5;
  private static LatencyThreshold = 5e3;

  public connectTime?: number;
  private socket?: WebSocket;
  private socketCb?: WebSocketCallback;
  private startConnectTime?: number;
  private messageListenerAttached = false;
  private readonly log;
  private readonly exitNodes: Map<string, ExitNode>;
  private readonly exitDatas: Map<string, ExitData> = new Map(); // exitId -> latencies

  constructor(
    public readonly entryNode: EntryNode,
    exitNodes: Iterable<ExitNode>
  ) {
    const id = shortPeerId(entryNode.peerId);
    this.log = createLogger([`nodepair-${id}`]);
    // ensure entry node not included in exits
    const exits = Array.from(exitNodes).filter((n) => id !== n.peerId);
    this.exitNodes = new Map(exits.map((n) => [n.peerId, n]));
    this.exitDatas = new Map(
      exits.map((n) => [
        n.peerId,
        {
          failedRequests: 0,
          latencies: [],
          ongoingRequests: 0,
          successfulRequests: 0,
        },
      ])
    );
  }

  public get id() {
    return this.entryNode.peerId;
  }

  public requestStarted = (exitId: string): number | undefined => {
    const data = this.exitDatas.get(exitId);
    if (data) {
      data.ongoingRequests += 1;
      return data.ongoingRequests;
    }
  };

  public requestSucceeded = (
    exitId: string,
    responseTime: number
  ): number | undefined => {
    const data = this.exitDatas.get(exitId);
    if (data) {
      data.ongoingRequests -= 1;
      data.successfulRequests += 1;
      data.latencies.push(responseTime);
      if (data.latencies.length > NodePair.KeepLastLatencies) {
        data.latencies.shift();
      }
      return data.successfulRequests;
    }
  };

  public requestFailed = (exitId: string): number | undefined => {
    const data = this.exitDatas.get(exitId);
    if (data) {
      data.ongoingRequests -= 1;
      data.failedRequests += 1;
      return data.failedRequests;
    }
  };

  public connect = (wsCb: WebSocketCallback) => {
    this.socket = NodesAPI.connectWS(this.entryNode);
    this.socketCb = wsCb;
    this.startConnectTime = Date.now();
    this.socket.on("open", this.onWSopen);
    this.socket.on("close", this.onWSclose);
    this.socket.on("error", this.onWSerror);
  };

  public close = () => {
    // detach message liteners
    if (this.messageListenerAttached) {
      this.socket!.onmessage = () => {};
    }
    this.socket?.off("open", this.onWSopen);
    this.socket?.off("close", this.onWSclose);
    this.socket?.off("error", this.onWSerror);
    // close socket
    this.socket?.close();
  };

  public readyExitNode = ():
    | { res: "ok"; exitNode: ExitNode }
    | { res: "error"; reason: string } => {
    if (this.exitNodes.size === 0) {
      return { res: "error", reason: "no exit nodes" };
    }
    if (!this.socket) {
      return { res: "error", reason: "no websocket" };
    }
    const readyState = this.socket.readyState;
    if (!(readyState === WebSocket.OPEN)) {
      return {
        res: "error",
        reason: `websocket readyState is ${printReadyState(readyState)}`,
      };
    }

    // calculate averages over stored latencies
    const avgs = Array.from(this.exitDatas)
      // discard failed request nodes
      .filter(([, { failedRequests }]) => failedRequests === 0)
      .map(([id, data]) => ({
        id,
        avg: average(data.latencies),
        req: data.ongoingRequests,
      }))
      // discard latency violations
      .filter(({ avg }) => avg < NodePair.LatencyThreshold);
    // sort by ongoing requests
    avgs.sort(({ req: lReq }, { req: rReq }) => lReq - rReq);
    if (avgs.length === 0) {
      return { res: "error", reason: "no good nodes" };
    }

    // find minimal request count nodes
    const minReq = avgs[0].req;
    const reqInc = avgs.findIndex(({ req }) => req > minReq);
    const minReqNodes = reqInc < 0 ? avgs : avgs.slice(0, reqInc);
    // prefer real latency nodes over fresh ones
    const realLats = minReqNodes.filter(({ avg }) => avg > 0);
    if (realLats.length > 0) {
      realLats.sort(({ avg: lAvg }, { avg: rAvg }) => lAvg - rAvg);
      const { id } = realLats[0];
      const exitNode = this.exitNodes.get(id)!;
      return { res: "ok", exitNode };
    }
    const { id } = randomEl(minReqNodes);
    const exitNode = this.exitNodes.get(id)!;
    return { res: "ok", exitNode };
  };

  public set messageListener(wsListen: (evt: MessageEvent) => void) {
    if (!this.socket) {
      return;
    }
    if (!this.messageListenerAttached) {
      this.socket.onmessage = wsListen;
      this.messageListenerAttached = true;
    }
  }

  public hasOngoing = () => {
    return !!Array.from(this.exitDatas.values()).find(
      (d) => d.ongoingRequests > 0
    );
  };

  public prettyPrint = (): string => {
    const exCount = this.exitNodes.size;
    const exStrs = Array.from(this.exitDatas.values()).map((d) => {
      const tot = d.failedRequests + d.successfulRequests;
      const s = d.successfulRequests;
      const o = d.ongoingRequests;
      return `${s}/${tot}+${o}`;
    });
    return `${this.id}_${exCount}x:${exStrs.join("-")}`;
  };

  private onWSopen = () => {
    this.connectTime = Date.now() - this.startConnectTime!;
    this.log.verbose("onWSopen after", this.connectTime, "ms");
    this.socketCb?.onOpen(this.id, this.connectTime);
  };

  private onWSclose = (evt: CloseEvent) => {
    this.log.info("onWSclose", evt);
    this.socketCb?.onClose(this.id, evt);
  };

  private onWSerror = (err: Error) => {
    this.log.error("onWSerror", err);
    this.socketCb?.onError(this.id, err);
  };
}

function printReadyState(readyState: number): string {
  switch (readyState) {
    case WebSocket.CONNECTING:
      return "CONNECTING";
    case WebSocket.OPEN:
      return "OPEN";
    case WebSocket.CLOSING:
      return "CLOSING";
    case WebSocket.CLOSED:
      return "CLOSED";
    default:
      return "unexpected";
  }
}
