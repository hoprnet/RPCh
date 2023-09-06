import { shortPeerId, randomEl } from "./utils";
import * as NodePair from "./node-pair";
import * as EntryData from "./entry-data";
import * as ExitData from "./exit-data";
import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

export type ResultOk = {
  success: true;
  entryNode: EntryNode;
  exitNode: ExitNode;
  via: string;
};

export type ResultErr = { success: false; error: string };

export type Result = ResultOk | ResultErr;

type Pairing = {
  entryNode: EntryNode;
  exitNode: ExitNode;
};

type EntryPerf = EntryData.Perf & { entryNode: EntryNode };
type ExitPerf = ExitData.Perf & Pairing;

/**
 * Try to distribute evenly with best route pairs preferred.
 *
 */
export function routePair(nodePairs: Map<string, NodePair.NodePair>): Result {
  const routePerfs = createRoutePerfs(nodePairs);
  // special case no nodes
  if (routePerfs.length === 0) {
    return { success: false, error: "no nodes" };
  }
  // special case only one route
  if (routePerfs.length === 1) {
    return success(routePerfs[0], "only route available");
  }

  ////
  // 1. compare exit node performances
  const xLeastErrs = leastReqErrors(routePerfs);
  console.log("bar1", xLeastErrs.length);
  if (xLeastErrs.length === 1) {
    return success(xLeastErrs[0], "least request errors");
  }
  const xBestLats = bestReqLatencies(xLeastErrs);
  console.log("bar2", xBestLats.length);
  if (xBestLats.length > 0) {
    return success(xBestLats[0], "best request latency");
  }
  const xLeastOngoing = leastReqOngoing(xLeastErrs);
  console.log("bar3", xLeastOngoing.length);
  if (xLeastOngoing.length === 1) {
    return success(xLeastOngoing[0], "least ongoing requests");
  }

  const entryPerfs = createEntryPerfs(nodePairs, xLeastOngoing);
  console.log("bar4", entryPerfs.length);

  ////
  // 2. compare entry node performances
  const eLeastErrs = leastSegErrors(entryPerfs);
  console.log("bar5", eLeastErrs.length);
  if (eLeastErrs.length === 1) {
    return eSuccess(eLeastErrs[0], xLeastOngoing, "least segment errors");
  }
  const eBestLats = bestSegLatencies(eLeastErrs);
  console.log("bar6", eBestLats.length);
  if (eBestLats.length > 0) {
    return eSuccess(eBestLats[0], xLeastOngoing, "best segment latency");
  }
  const eLeastOngoing = leastSegOngoing(eLeastErrs);
  console.log("bar7", eLeastOngoing.length);
  if (eLeastOngoing.length === 1) {
    return eSuccess(eLeastOngoing[0], xLeastOngoing, "least ongoing segments");
  }
  const eLeastMsgsErrs = leastMsgsErrors(eLeastOngoing);
  console.log("bar8", eLeastMsgsErrs.length);
  if (eLeastMsgsErrs.length === 1) {
    return eSuccess(
      eLeastMsgsErrs[0],
      xLeastOngoing,
      "least message retrieval errors"
    );
  }
  const eBestMsgsLats = bestMsgsLatencies(eLeastMsgsErrs);
  console.log("bar9", eBestMsgsLats.length);
  if (eBestMsgsLats.length > 0) {
    return eSuccess(
      eBestMsgsLats[0],
      xLeastOngoing,
      "best message retrieval latency"
    );
  }

  ////
  // 3. compare ping speed
  const eQuickestPing = quickestPing(eLeastMsgsErrs);
  if (eQuickestPing.length > 0) {
    return eSuccess(eQuickestPing[0], xLeastOngoing, "quickest version ping");
  }

  return { success: false, error: "insufficient data" };
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

function success({ entryNode, exitNode }: Pairing, via: string): ResultOk {
  return {
    success: true,
    entryNode,
    exitNode,
    via,
  };
}

function createRoutePerfs(nodePairs: Map<string, NodePair.NodePair>) {
  return Array.from(nodePairs.values()).reduce<ExitPerf[]>((acc, np) => {
    const perfs = Array.from(np.exitDatas).map(([xId, xd]) => ({
      ...ExitData.perf(xd),
      entryNode: np.entryNode,
      exitNode: np.exitNodes.get(xId)!,
    }));
    return acc.concat(perfs);
  }, []);
}

function leastReqErrors(routePerfs: ExitPerf[]): ExitPerf[] {
  routePerfs.sort((l, r) => l.failures - r.failures);
  const min = routePerfs[0].failures;
  const idx = routePerfs.findIndex(({ failures }) => min < failures);
  if (idx > 0) {
    return routePerfs.slice(0, idx);
  }
  return routePerfs;
}

function bestReqLatencies(routePerfs: ExitPerf[]): ExitPerf[] {
  const haveLats = routePerfs.filter(({ avgLats }) => avgLats > 0);
  haveLats.sort((l, r) => l.avgLats - r.avgLats);
  return haveLats;
}

function leastReqOngoing(routePerfs: ExitPerf[]): ExitPerf[] {
  routePerfs.sort((l, r) => l.ongoing - r.ongoing);
  const min = routePerfs[0].ongoing;
  const idx = routePerfs.findIndex(({ ongoing }) => min < ongoing);
  if (idx > 0) {
    return routePerfs.slice(0, idx);
  }
  return routePerfs;
}

function eSuccess(
  { entryNode }: EntryPerf,
  routePerfs: ExitPerf[],
  via: string
): ResultOk {
  const xPerfs = routePerfs.filter(
    ({ entryNode: en }) => en.id === entryNode.id
  );
  const el = randomEl(xPerfs);
  return {
    success: true,
    entryNode,
    exitNode: el.exitNode,
    via,
  };
}

function createEntryPerfs(
  nodePairs: Map<string, NodePair.NodePair>,
  routePerfs: ExitPerf[]
): EntryPerf[] {
  const entryNodes = routePerfs.map(({ entryNode }) => entryNode);
  return Array.from(new Set(entryNodes)).map((entryNode) => {
    const ed = nodePairs.get(entryNode.id)!.entryData;
    return {
      ...EntryData.perf(ed),
      entryNode,
    };
  });
}

function leastSegErrors(entryPerfs: EntryPerf[]): EntryPerf[] {
  entryPerfs.sort((l, r) => l.segFailures - r.segFailures);
  const min = entryPerfs[0].segFailures;
  const idx = entryPerfs.findIndex(({ segFailures }) => min < segFailures);
  if (idx > 0) {
    return entryPerfs.slice(0, idx);
  }
  return entryPerfs;
}

function bestSegLatencies(entryPerfs: EntryPerf[]): EntryPerf[] {
  const haveLats = entryPerfs.filter(({ segAvgLats }) => segAvgLats > 0);
  haveLats.sort((l, r) => l.segAvgLats - r.segAvgLats);
  return haveLats;
}

function leastSegOngoing(entryPerfs: EntryPerf[]): EntryPerf[] {
  entryPerfs.sort((l, r) => l.segOngoing - r.segOngoing);
  const min = entryPerfs[0].segOngoing;
  const idx = entryPerfs.findIndex(({ segOngoing }) => min < segOngoing);
  if (idx > 0) {
    return entryPerfs.slice(0, idx);
  }
  return entryPerfs;
}

function leastMsgsErrors(entryPerfs: EntryPerf[]): EntryPerf[] {
  entryPerfs.sort((l, r) => l.msgsFails - r.msgsFails);
  const min = entryPerfs[0].msgsFails;
  const idx = entryPerfs.findIndex(({ msgsFails }) => min < msgsFails);
  if (idx > 0) {
    return entryPerfs.slice(0, idx);
  }
  return entryPerfs;
}

function bestMsgsLatencies(entryPerfs: EntryPerf[]): EntryPerf[] {
  const haveLats = entryPerfs.filter(({ msgsAvgLats }) => msgsAvgLats > 0);
  haveLats.sort((l, r) => l.msgsAvgLats - r.msgsAvgLats);
  return haveLats;
}

function quickestPing(entryPerfs: EntryPerf[]): EntryPerf[] {
  console.log("FOO1", entryPerfs);
  const havePing = entryPerfs.filter(({ pingDuration }) => pingDuration > 0);
  console.log("FOO2", havePing);
  havePing.sort((l, r) => l.pingDuration - r.pingDuration);
  console.log("FOO3", havePing);
  return havePing;
}
