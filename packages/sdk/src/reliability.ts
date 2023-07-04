export type OnlineHistoryEntry = { date: number; online: boolean };

export type Reliability = {
  onlineHistory: OnlineHistoryEntry[];
};

export function empty(): Reliability {
  return {
    onlineHistory: [],
  };
}

export function updateOnline(rel: Reliability, online: boolean) {
  const entry = { date: Date.now(), online };
  rel.onlineHistory.push(entry);
  return rel;
}

export function isReliable(rel: Reliability) {
  // no history
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
