import { WebSocket, MessageEvent, CloseEvent } from "isomorphic-ws";

import * as NodeAPI from "./node-api";
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

  private socket?: WebSocket;
  private socketCb?: WebSocketCallback;
  private messageListenerAttached = false;
  private readonly log;
  private readonly exitNodes: Map<string, ExitNode>;
  private readonly exitDatas: Map<string, ExitData> = new Map(); // exitId -> latencies

  constructor(
    public readonly entryNode: EntryNode,
    exitNodes: Iterable<ExitNode>
  ) {
    const shortId = shortPeerId(entryNode.id);
    this.log = createLogger([`nodepair${shortId}(${entryNode.apiEndpoint})`]);
    // ensure entry node not included in exits
    const exits = Array.from(exitNodes).filter((n) => entryNode.id !== n.id);
    this.exitNodes = new Map(exits.map((n) => [n.id, n]));
    this.exitDatas = new Map(
      exits.map((n) => [
        n.id,
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
    return this.entryNode.id;
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
      // detach message liteners if no ongoing requests
      if (!this.hasOngoing()) {
        this.socket!.onmessage = null;
      }
      return data.successfulRequests;
    }
  };

  public requestFailed = (exitId: string): number | undefined => {
    const data = this.exitDatas.get(exitId);
    if (data) {
      data.ongoingRequests -= 1;
      data.failedRequests += 1;
      // detach message liteners if no ongoing requests
      if (!this.hasOngoing()) {
        this.socket!.onmessage = null;
      }
      return data.failedRequests;
    }
  };

  public ping = (): Promise<number> => {
    return new Promise((res) => {
      const startPingTime = Date.now();
      NodeAPI.version(this.entryNode).then((_) => {
        return res(Date.now() - startPingTime);
      });
    });
  };

  public close = () => {
    // detach message liteners
    if (this.messageListenerAttached) {
      this.socket!.onmessage = null;
    }
    this.socket?.off("open", this.onWSopen);
    this.socket?.off("close", this.onWSclose);
    this.socket?.off("error", this.onWSerror);
    // close socket shenanigan, because cannot close a connecting websocket
    if (this.socket?.readyState === WebSocket.CONNECTING) {
      const cb = () => {
        this.socket?.off("open", cb);
        this.socket?.off("close", cb);
        this.socket?.off("error", cb);
        this.socket?.close();
      };
      this.socket.on("open", cb);
      this.socket.on("close", cb);
      this.socket.on("error", cb);
    } else {
      this.socket?.close();
    }
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
      if (tot === 0) {
        if (o === 0) {
          return "0";
        }
        return `0+${o}`;
      }
      return `${s}/${tot}+${o}`;
    });
    return `${shortPeerId(this.id)}_${exCount}x:${exStrs.join("-")}`;
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
