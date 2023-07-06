import * as Reliability from "./reliability";
import type { EntryNode, ExitNode } from "./nodes-collector";

/**
 * This algorithm will be subject to change.
 * It is the base of how entry and exit nodes are selected.
 * Needs testing with more data.
 *
 * Currently it works like this:
 *
 * For every entry node there is an LIFO queue of its online state.
 * Every entry node also keeps LIFO queues of their failed/success pairings with exit nodes.
 * For now we just take all exit nodes, combine them with all entry nodes, remove all recent failures and ongoing requests.
 *
 * This essentially means that each entry - exit node pair can only handle one request concurrently.
 * This will no scale well, but might be enough to understand reliability problems for now.
 *
 */
export default function (
  entryNodes: Map<string, EntryNode>,
  exitNodes: Map<string, ExitNode>,
  reliabilities: Map<string, Reliability.Reliability>
):
  | { res: "ok"; entryNode: EntryNode; exitNode: ExitNode }
  | { res: "error"; reason: string } {
  const entryIds = Array.from(entryNodes.keys());
  if (entryIds.length === 0) {
    return { res: "error", reason: "no entry nodes" };
  }

  // 1. determine online entry nodes
  const onlineIds = entryIds.filter(function (id) {
    const rel = reliabilities.get(id)!;
    return Reliability.isOnline(rel);
  });
  if (onlineIds.length === 0) {
    return { res: "error", reason: "no online entry nodes" };
  }

  // 2. gather all tryable entry - exit node pairs
  const entryExitSelection = onlineIds
    .map(function (entryId) {
      const rel = reliabilities.get(entryId)!;
      // take all exit nodes and remove recent failures, coincidentally will remove ongoing requests as well
      const tryableIds = Array.from(exitNodes.keys()).filter(function (exitId) {
        return !Reliability.isCurrentlyFailure(rel, exitId);
      });
      return tryableIds.map(function (exitId) {
        return {
          entryNode: entryNodes.get(entryId)!,
          exitNode: exitNodes.get(exitId)!,
        };
      });
    })
    .flat();

  if (entryExitSelection.length === 0) {
    return { res: "error", reason: "no tryable entry - exit pair found" };
  }

  const el = randomEl(entryExitSelection);
  return { ...el, res: "ok" };
}

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
