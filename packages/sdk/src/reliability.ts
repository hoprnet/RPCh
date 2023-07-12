import { shortPeerId } from "./utils";

const FRESH_SCORE = 0.81; // general score when considered fresh
const FRESHNESS_THRESHOLD = 10; // how many request successes/failures are needed to calculate score

const MAX_ONLINE_HISTORY_LENGTH = 100;
const MAX_EXIT_NODES_HISTORY_LENGTH = 100;

export type OnlineEntry = { date: number; online: boolean };

export type RequestEntry = {
  started: number;
  ended?: number;
  success: boolean;
  exitId: string;
  requestId: number;
};

export type Reliability = {
  onlineHistory: OnlineEntry[]; // LIFO queue, most recent element is at front
  exitNodesHistory: Map<string, number[]>; // exitId -> requestIds LIFO
  requestHistory: Map<number, RequestEntry>; // requestId -> RequestEntry
};

export function empty(): Reliability {
  return {
    onlineHistory: [],
    exitNodesHistory: new Map(),
    requestHistory: new Map(),
  };
}

export function updateOnline(rel: Reliability, online: boolean): Reliability {
  const entry = { date: Date.now(), online };
  rel.onlineHistory.unshift(entry);
  while (rel.onlineHistory.length > MAX_ONLINE_HISTORY_LENGTH) {
    rel.onlineHistory.pop();
  }
  return rel;
}

export function expireOlderThan(
  rel: Reliability,
  timeout: number
): Reliability {
  const threshold = Date.now() - timeout;

  // remove old request history entries
  for (const id of rel.requestHistory.keys()) {
    const entry = rel.requestHistory.get(id)!;
    if (entry.ended && entry.ended < threshold) {
      rel.requestHistory.delete(id);
      removeExitNodesHistory(rel, entry.exitId, entry.requestId);
    }
  }

  return rel;
}

export function startRequest(
  rel: Reliability,
  { exitId, requestId }: { exitId: string; requestId: number }
): { res: "ok"; rel: Reliability } | { res: "error"; reason: string } {
  const logRef = { exitId: shortPeerId(exitId), requestId };

  if (rel.requestHistory.has(requestId)) {
    return {
      res: "error",
      reason: `request history already contains ${logRef}`,
    };
  }

  const entry = {
    started: Date.now(),
    success: false,
    exitId,
    requestId,
    ended: undefined,
  };
  rel.requestHistory.set(requestId, entry);
  addExitNodesHistory(rel, exitId, requestId);
  return { res: "ok", rel };
}

export function finishRequest(
  rel: Reliability,
  {
    exitId,
    requestId,
    result,
  }: { exitId: string; requestId: number; result: boolean }
): { res: "ok"; rel: Reliability } | { res: "error"; reason: string } {
  const logRef = { exitId: shortPeerId(exitId), requestId };
  const reqEntry = rel.requestHistory.get(requestId);
  if (!reqEntry) {
    return {
      res: "error",
      reason: `no request history entry found for ${logRef}`,
    };
  }
  if (reqEntry.ended) {
    return {
      res: "error",
      reason: `request already finished for ${logRef}`,
    };
  }

  const entry = {
    ...reqEntry,
    ended: Date.now(),
    success: result,
  };
  rel.requestHistory.set(requestId, entry);
  return { res: "ok", rel };
}

export function isEmpty({
  onlineHistory,
  requestHistory,
}: Reliability): boolean {
  if (requestHistory.size > 0) {
    return false;
  }
  return onlineHistory.length === 0;
}

export function isOnline(rel: Reliability): boolean {
  // no history - means no websocket connection, or unused for long period
  if (rel.onlineHistory.length === 0) {
    return false;
  }
  // for now only take last online state into account
  return rel.onlineHistory[0].online;
}

/**
 * Will return true if last request was successfull.
 * False if not or still ongoing.
 */
export function isCurrentlySuccessful(
  { exitNodesHistory, requestHistory }: Reliability,
  exitNodeId: string
): boolean {
  const hist = exitNodesHistory.get(exitNodeId);
  if (hist && hist.length > 0) {
    const req = requestHistory.get(hist[0])!;
    return req.success;
  }
  return false;
}

/**
 * Will return true if last request is still onoing.
 */
export function isCurrentlyBusy(
  { exitNodesHistory, requestHistory }: Reliability,
  exitNodeId: string
): boolean {
  const hist = exitNodesHistory.get(exitNodeId);
  if (hist && hist.length > 0) {
    const req = requestHistory.get(hist[0])!;
    return !req.ended;
  }
  return false;
}

export function calculate(
  { exitNodesHistory, requestHistory }: Reliability,
  exitNodeId: string
): number {
  const hist = exitNodesHistory.get(exitNodeId);
  if (!hist || hist.length < FRESHNESS_THRESHOLD) {
    return FRESH_SCORE;
  }
  const successes = hist.filter((rId) => requestHistory.get(rId)!.success);
  return successes.length / hist.length;
}

export function prettyPrintOnlineHistory({
  onlineHistory,
}: Reliability): string {
  if (onlineHistory.length === 0) {
    return "[]";
  }
  const last = onlineHistory[0].date;
  const { s, e, start, acc } = onlineHistory.reduce(
    (
      {
        s,
        e,
        start,
        acc,
      }: { s: number; e: number; start: number; acc: string[] },
      { date, online }
    ) => {
      if (online && e > 0) {
        // switch to success, count errors
        const diff = last - start;
        const dStr = diff === 0 ? "_" : `-${diff}ms`;
        acc.unshift(`(_${e}|${dStr})`);
      }
      if (!online && s > 0) {
        // switch to error, count successes
        const diff = last - start;
        const dStr = diff === 0 ? "_" : `-${diff}ms`;
        acc.unshift(`(o${e}|${dStr})`);
      }

      if (online && s > 0) {
        // accum online
        return { s: s + 1, e, acc, start };
      }
      if (!online && e > 0) {
        // accum offline
        return { s, e: e + 1, acc, start };
      }
      if (online) {
        // start online
        return { s: 1, e: 0, acc, start: date };
      }
      //start offline
      return { s: 0, e: 1, acc, start: date };
    },
    { s: 0, e: 0, start: 0, acc: [] }
  );
  if (s > 0) {
    // count missing successes from reduction
    const diff = last - start;
    const dStr = diff === 0 ? "_" : `-${diff}ms`;
    acc.unshift(`(o${s}|${dStr})`);
  }
  if (e > 0) {
    // count missing errors from reduction
    const diff = last - start;
    const dStr = diff === 0 ? "_" : `-${diff}ms`;
    acc.unshift(`(_${e}|${dStr})`);
  }
  return `[${acc.join(" ")}]`;
}

export function prettyPrintExitNodesHistory({
  exitNodesHistory,
  requestHistory,
}: Reliability): string {
  const all = Array.from(exitNodesHistory.entries()).map(([id, hist]) => {
    if (hist.length === 0) {
      return `${shortPeerId(id)}:[]`;
    }
    const last = requestHistory.get(hist[0])!.started;
    const strs = hist.map((rId) => {
      const req = requestHistory.get(rId)!;
      const diff = last - req.started;
      const dStr = diff === 0 ? "_" : `-${diff}ms`;
      if (req.ended) {
        const dur = req.ended - req.started;
        const suc = req.success ? "o" : "_";
        return `(${suc}|${dur}ms|${dStr})`;
      }
      return `(..|${dStr})`;
    });
    return `${shortPeerId(id)}:[${strs.join(" ")}]`;
  });
  return `{${all.join(" ")}}`;
}

function addExitNodesHistory(
  rel: Reliability,
  exitId: string,
  requestId: number
) {
  if (rel.exitNodesHistory.has(exitId)) {
    const hist = rel.exitNodesHistory.get(exitId)!;
    hist.unshift(requestId);
    while (hist.length > MAX_EXIT_NODES_HISTORY_LENGTH) {
      hist.pop();
    }
  } else {
    rel.exitNodesHistory.set(exitId, [requestId]);
  }
}

function removeExitNodesHistory(
  rel: Reliability,
  exitId: string,
  requestId: number
) {
  const hist = rel.exitNodesHistory.get(exitId);
  if (hist) {
    const newHist = hist.filter((rId) => rId !== requestId);
    if (newHist.length === 0) {
      rel.exitNodesHistory.delete(exitId);
    } else {
      rel.exitNodesHistory.set(exitId, newHist);
    }
  }
}
