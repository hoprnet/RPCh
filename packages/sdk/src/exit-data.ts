import * as NodeMatch from "./node-match";
import * as PerfData from "./perf-data";
import * as Request from "./request";
import { average } from "./utils";

export type Perf = {
  ongoing: number;
  failures: number;
  successes: number;
  total: number;
  avgLats: number;
};

export type ExitData = {
  requestsOngoing: number[]; // sorted ongoing request ids
  requestsHistory: number[]; // sorted resolved request ids
  requests: Map<number, PerfData.PerfData>; // request data
};

export function create() {
  return {
    requestsOngoing: [],
    requestsHistory: [],
    requests: new Map(),
  };
}

export function addOngoing(xd: ExitData, req: Request.Request) {
  xd.requestsOngoing.push(req.id);
  xd.requests.set(req.id, PerfData.ongoing());
}

export function recSuccess(xd: ExitData, req: Request.Request, dur: number) {
  xd.requestsOngoing = xd.requestsOngoing.filter((rId) => rId !== req.id);
  xd.requestsHistory.push(req.id);
  if (xd.requestsHistory.length > NodeMatch.MaxRequestsHistory) {
    const rId = xd.requestsHistory.shift() as number;
    xd.requests.delete(rId);
  }
  const perf = xd.requests.get(req.id);
  if (perf) {
    PerfData.success(perf, dur);
  }
}

export function recFailed(xd: ExitData, req: Request.Request) {
  xd.requestsOngoing = xd.requestsOngoing.filter((rId) => rId !== req.id);
  xd.requestsHistory.push(req.id);
  if (xd.requestsHistory.length > NodeMatch.MaxRequestsHistory) {
    const rId = xd.requestsHistory.shift() as number;
    xd.requests.delete(rId);
  }
  const perf = xd.requests.get(req.id);
  if (perf) {
    PerfData.failure(perf);
  }
}

export function perf(xd: ExitData): Perf {
  const ongoing = xd.requestsOngoing.length;
  const total = xd.requestsHistory.length;
  const latsRaw = xd.requestsHistory.map(
    (rId) => xd.requests.get(rId)?.latency
  );
  const lats = latsRaw.filter((l) => !!l) as number[];
  const successes = lats.length;
  const failures = total - successes;
  const avgLats = average(lats);
  return {
    ongoing,
    failures,
    successes,
    total,
    avgLats,
  };
}
