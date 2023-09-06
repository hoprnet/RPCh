import { shortPeerId, randomEl } from "./utils";
import * as NodePair from "./node-pair";
import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

type ResultOk = {
  success: true;
  entryNode: EntryNode;
  exitNode: ExitNode;
  via: string;
};

type ResultErr = { success: false; error: string };

export type Result = ResultOk | ResultErr;

export function routePair(nodePairs: Map<string, NodePair.NodePair>): Result {
  // finding best currently available node pair
  const np = quickestPing(nodePairs);
  if (np) {
    const exit = randomEl(Array.from(np.exitNodes.values()));
    return {
      success: true,
      entryNode: np.entryNode,
      exitNode: exit,
      via: "quickest ping",
    };
  }
  return { success: false, error: "none available" };
}

export function isOk(res: Result): res is ResultOk {
  return res.success;
}

export function prettyPrint(res: Result) {
  if (isOk(res)) {
    const eId = shortPeerId(res.entryNode.id);
    const xId = shortPeerId(res.exitNode.id);
    return `${eId} > ${xId} (via ${res.via})`;
  }
  return `${res.error}`;
}

/**
 * Sort by ping durations. Nodes with no ping value will be sorted last.
 */
function quickestPing(nodePairs: Map<string, NodePair.NodePair>) {
  const arr = Array.from(nodePairs.values()).filter(
    (np) => !!np.pingDuration
  ) as (NodePair.NodePair & { pingDuration: number })[];
  arr.sort((l, r) => {
    return l.pingDuration - r.pingDuration;
  });
  return arr[0];
}

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
