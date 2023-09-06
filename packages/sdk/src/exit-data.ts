import * as PerfData from "./perf-data";
import * as Request from "./request";

// requests measure quality of exit nodes
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

export function recSuccess(
  xd: ExitData,
  req: Request.Request,
  maxHistory: number,
  dur: number
) {
  xd.requestsOngoing = xd.requestsOngoing.filter((rId) => rId !== req.id);
  xd.requestsHistory.push(req.id);
  if (xd.requestsHistory.length > maxHistory) {
    const rId = xd.requestsHistory.shift() as number;
    xd.requests.delete(rId);
  }
  const perf = xd.requests.get(req.id);
  if (perf) {
    PerfData.success(perf, dur);
  }
}

export function recFailed(
  xd: ExitData,
  req: Request.Request,
  maxHistory: number
) {
  xd.requestsOngoing = xd.requestsOngoing.filter((rId) => rId !== req.id);
  xd.requestsHistory.push(req.id);
  if (xd.requestsHistory.length > maxHistory) {
    const rId = xd.requestsHistory.shift() as number;
    xd.requests.delete(rId);
  }
  const perf = xd.requests.get(req.id);
  if (perf) {
    PerfData.failure(perf);
  }
}
