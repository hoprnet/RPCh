export type OnlineHistoryEntry = { date: number; online: boolean };

export type NodeHistoryEntry = { date: number; success: boolean };

export type Reliability = {
  onlineHistory: OnlineHistoryEntry[];
  exitNodesHistory: Map<string, NodeHistoryEntry[]>;
};

export function empty(): Reliability {
  return {
    onlineHistory: [],
    exitNodesHistory: new Map(),
  };
}

export function updateOnline(rel: Reliability, online: boolean) {
  const entry = { date: Date.now(), online };
  rel.onlineHistory.push(entry);
  return rel;
}

export function expireOlderThan(
  { onlineHistory, exitNodesHistory }: Reliability,
  timeout: number
) {
  // remove old online history entries
  const threshold = Date.now() - timeout;
  const onlineIdx = onlineHistory.findIndex(function ({ date }) {
    return date > threshold;
  });
  if (onlineIdx > 0) {
    onlineHistory = onlineHistory.slice(onlineIdx);
  }

  // remove old exit nodes history entries
  for (const id of exitNodesHistory.keys()) {
    const hist = exitNodesHistory.get(id)!;
    const idx = hist.findIndex(function ({ date }) {
      return date > threshold;
    });
    if (idx > 0) {
      exitNodesHistory.set(id, hist.slice(idx));
    }
  }

  return {
    onlineHistory,
    exitNodesHistory,
  };
}

export function updateExitNode(
  rel: Reliability,
  peerId: string,
  success: boolean
) {
  const entry = { date: Date.now(), success };
  let hist = rel.exitNodesHistory.get(peerId);
  if (hist) {
    hist.push(entry);
  } else {
    hist = [];
  }
  rel.exitNodesHistory.set(peerId, hist);
  return rel;
}

export function isEmpty({ onlineHistory, exitNodesHistory }: Reliability) {
  for (const hist of exitNodesHistory.values()) {
    if (hist.length > 0) {
      return false;
    }
  }
  return onlineHistory.length === 0;
}

export function isReliable(rel: Reliability) {
  // no history - means no websocket connection, or unused for long period
  if (rel.onlineHistory.length === 0) {
    return false;
  }
  // for now only take last online state into account
  const history = Array.from(rel.onlineHistory);
  history.sort(compare);
  return history[0].online;
}

function compare(
  { date: dateA }: OnlineHistoryEntry,
  { date: dateB }: OnlineHistoryEntry
): number {
  return dateB - dateA;
}
