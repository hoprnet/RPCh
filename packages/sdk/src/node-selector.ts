// import { average, createLogger, randomEl, shortPeerId } from "./utils";
import NodePair from "./node-pair";

export function routePair(nodePairs: Map<string, NodePair>) {
  // TODO

  for (const np of nodePairs.values()) {
    const ex = np.getExit();
    if (ex) {
      return { res: "ok", entryNode: np.entryNode, exitNode: ex };
    }
  }
  return { res: "error", reason: "none" };
}

//
//   public close = () => {
//     // detach message liteners
//     if (this.messageListenerAttached) {
//       this.socket!.onmessage = null;
//     }
//     this.socket?.off("close", this.onWSclose);
//     this.socket?.off("error", this.onWSerror);
//     // close socket shenanigan, because cannot close a connecting websocket
//     if (this.socket?.readyState === WebSocket.CONNECTING) {
//       const cb = () => {
//         this.socket?.off("open", cb);
//         this.socket?.off("close", cb);
//         this.socket?.off("error", cb);
//         this.socket?.close();
//       };
//       this.socket.on("open", cb);
//       this.socket.on("close", cb);
//       this.socket.on("error", cb);
//     } else {
//       this.socket?.close();
//     }
//   };
//
//   public readyExitNode = ():
//     | { res: "ok"; exitNode: ExitNode }
//     | { res: "error"; reason: string } => {
//     if (this.exitNodes.size === 0) {
//       return { res: "error", reason: "no exit nodes" };
//     }
//     if (!this.socket) {
//       return { res: "error", reason: "no websocket" };
//     }
//     const readyState = this.socket.readyState;
//     if (!(readyState === WebSocket.OPEN)) {
//       return {
//         res: "error",
//         reason: `websocket readyState is ${printReadyState(readyState)}`,
//       };
//     }
//
//     // calculate averages over stored latencies
//     const avgs = Array.from(this.exitDatas)
//       // discard failed request nodes
//       .filter(([, { failedRequests }]) => failedRequests === 0)
//       .map(([id, data]) => ({
//         id,
//         avg: average(data.latencies),
//         req: data.ongoingRequests,
//       }))
//       // discard latency violations
//       .filter(({ avg }) => avg < NodePair.LatencyThreshold);
//     // sort by ongoing requests
//     avgs.sort(({ req: lReq }, { req: rReq }) => lReq - rReq);
//     if (avgs.length === 0) {
//       return { res: "error", reason: "no good nodes" };
//     }
//
//     // find minimal request count nodes
//     const minReq = avgs[0].req;
//     const reqInc = avgs.findIndex(({ req }) => req > minReq);
//     const minReqNodes = reqInc < 0 ? avgs : avgs.slice(0, reqInc);
//     // prefer real latency nodes over fresh ones
//     const realLats = minReqNodes.filter(({ avg }) => avg > 0);
//     if (realLats.length > 0) {
//       realLats.sort(({ avg: lAvg }, { avg: rAvg }) => lAvg - rAvg);
//       const { id } = realLats[0];
//       const exitNode = this.exitNodes.get(id)!;
//       return { res: "ok", exitNode };
//     }
//     const { id } = randomEl(minReqNodes);
//     const exitNode = this.exitNodes.get(id)!;
//     return { res: "ok", exitNode };
//   };
