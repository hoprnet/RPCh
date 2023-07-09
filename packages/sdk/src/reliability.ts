import { shortPeerId } from "./utils";

const FRESH_SCORE = 0.8; // general score when considered fresh
const FRESHNESS_THRESHOLD = 5; // how many request successes/failures are needed to calculate score

const MAX_ONLINE_HISTORY_LENGTH = 100;

export type OnlineHistoryEntry = { date: number; online: boolean };

export type NodeHistoryEntry = {
  started: number;
  ended?: number;
  success: boolean;
  peerId: string;
  requestId: number;
};

export type Reliability = {
  onlineHistory: OnlineHistoryEntry[]; // LIFO queue
  exitNodesHistory: Map<string, NodeHistoryEntry[]>; // exitNodePeerId -> LIFO queue
  requestHistory: Map<number, NodeHistoryEntry>; // requestId -> NodeHistoryEntry
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
  { onlineHistory, exitNodesHistory, requestHistory }: Reliability,
  timeout: number
): Reliability {
  const threshold = Date.now() - timeout;

  // remove old exit nodes history entries
  for (const id of exitNodesHistory.keys()) {
    const hist = exitNodesHistory.get(id)!;
    const idx = hist.findIndex(({ ended }) => {
      if (ended) {
        return ended < threshold;
      }
      return false;
    });
    if (idx >= 0) {
      exitNodesHistory.set(id, hist.slice(0, idx));
    }
  }

  // remove old request history entries
  for (const id of requestHistory.keys()) {
    const entry = requestHistory.get(id)!;
    if (entry.ended && entry.ended < threshold) {
      requestHistory.delete(id);
    }
  }

  return {
    onlineHistory,
    exitNodesHistory,
    requestHistory,
  };
}

export function startRequest(
  rel: Reliability,
  peerId: string,
  requestId: number
): { res: "ok"; rel: Reliability } | { res: "error"; reason: string } {
  const logRef = { peerId, requestId };

  let hist = rel.exitNodesHistory.get(peerId);
  if (hist) {
    const histEntryIdx = hist.findIndex(
      ({ requestId: rId }) => rId === requestId
    );
    if (histEntryIdx >= 0) {
      return {
        res: "error",
        reason: `node history already contains ${logRef}`,
      };
    }
  }
  if (rel.requestHistory.has(requestId)) {
    return {
      res: "error",
      reason: `request history already contains ${logRef}`,
    };
  }

  const entry = {
    started: Date.now(),
    success: false,
    peerId,
    requestId,
    ended: undefined,
  };
  if (hist) {
    hist.unshift(entry);
  } else {
    hist = [entry];
  }
  rel.exitNodesHistory.set(peerId, hist);
  rel.requestHistory.set(requestId, entry);
  return { res: "ok", rel };
}

export function finishRequestWithResult(
  rel: Reliability,
  peerId: string,
  requestId: number,
  result: boolean
): { res: "ok"; rel: Reliability } | { res: "error"; reason: string } {
  const logRef = { peerId, requestId };
  const hist = rel.exitNodesHistory.get(peerId);
  if (!hist) {
    return {
      res: "error",
      reason: `no node history found for ${logRef}`,
    };
  }
  if (hist.length === 0) {
    return {
      res: "error",
      reason: `empty node history for ${logRef}`,
    };
  }
  const histEntryIdx = hist.findIndex(
    ({ requestId: rId }) => rId === requestId
  );
  if (histEntryIdx < 0) {
    return {
      res: "error",
      reason: `node history does not contain ${logRef}`,
    };
  }
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
  hist[histEntryIdx] = entry;
  rel.exitNodesHistory.set(peerId, hist);
  rel.requestHistory.set(requestId, entry);
  return { res: "ok", rel };
}

export function isEmpty({
  onlineHistory,
  exitNodesHistory,
  requestHistory,
}: Reliability): boolean {
  if (requestHistory.size > 0) {
    return false;
  }
  for (const hist of exitNodesHistory.values()) {
    if (hist.length > 0) {
      return false;
    }
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

export function isCurrentlyFailure(
  { exitNodesHistory }: Reliability,
  exitNodeId: string
): boolean {
  const hist = exitNodesHistory.get(exitNodeId);
  if (hist && hist.length > 0) {
    return !hist[0].success;
  }
  return false;
}

export function isCurrentlyBusy(
  { exitNodesHistory }: Reliability,
  exitNodeId: string
): boolean {
  const hist = exitNodesHistory.get(exitNodeId);
  if (hist && hist.length > 0) {
    return !hist[0].ended;
  }
  return false;
}

export function calculate(
  { exitNodesHistory }: Reliability,
  exitNodeId: string
): number {
  const hist = exitNodesHistory.get(exitNodeId);
  if (!hist || hist.length < FRESHNESS_THRESHOLD) {
    return FRESH_SCORE;
  }
  const success = hist.filter(({ success }) => success);
  return success.length / hist.length;
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
}: Reliability): string {
  const all = Array.from(exitNodesHistory.entries()).map(([id, hist]) => {
    if (hist.length === 0) {
      return `${shortPeerId(id)}:[]`;
    }
    const last = hist[0].started;
    const strs = hist.map((e) => {
      const diff = last - e.started;
      const dStr = diff === 0 ? "_" : `-${diff}ms`;
      if (e.ended) {
        const dur = e.ended - e.started;
        const suc = e.success ? "o" : "_";
        return `(${suc}|${dur}ms|${dStr})`;
      }
      return `(..|${dStr})`;
    });
    return `${shortPeerId(id)}:[${strs.join(" ")}]`;
  });
  return `{${all.join(" ")}}`;
}
