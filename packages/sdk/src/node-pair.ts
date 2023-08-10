import { WebSocket, MessageEvent } from "isomorphic-ws";
import * as NodesAPI from "./nodes-api";
import { average, createLogger, randomEl, shortPeerId } from "./utils";

export type EntryNode = {
  apiEndpoint: URL;
  accessToken: string;
  peerId: string;
  recommendedExits: Set<string>;
};

export type ExitNode = {
  peerId: string;
  pubKey: string;
};

export type Pair = {
  entryNode: EntryNode;
  exitNode: ExitNode;
};

type InternalState =
  | { s: "init" }
  | { s: "connect"; t: number }
  | { s: "open" };

type ExitData = {
  failedRequests: number;
  latencies: number[];
  ongoingRequests: number;
  successfulRequests: number;
};

export default class NodePair {
  public static TargetAmount = 10;
  private static KeepLastLatencies = 5;
  private static LatencyThreshold = 5e3;

  private socket?: WebSocket;
  private connectTime?: number;
  private messageListenerAttached = false;
  private internalState: InternalState = { s: "init" };
  private readonly log;
  private readonly exitNodes: Map<string, ExitNode> = new Map();
  private readonly exitDatas: Map<string, ExitData> = new Map(); // exitId -> latencies

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
      this.exitDatas.set(n.peerId, {
        failedRequests: 0,
        latencies: [],
        ongoingRequests: 0,
        successfulRequests: 0,
      });
    }
  };

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

  public connect = () => {
    this.socket = NodesAPI.connectWS(this.entryNode);
    this.internalState = { s: "connect", t: Date.now() };
    this.socket.on("open", this.onWSopen);
    this.socket.on("error", this.onWSerror);
    this.socket.on("close", this.onWSclose);
  };

  public close = () => {
    // detach message liteners
    if (this.messageListenerAttached) {
      this.socket!.onmessage = () => {};
    }
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
    const minReqNodes = avgs.slice(0, reqInc);
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
