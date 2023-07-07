import * as Reliability from "./reliability";
import type { EntryNode, ExitNode } from "./nodes-collector";

const RELIABILITY_THRESHOLD = 0.59; // general threshold used when running 2nd PASS

/**
 * This algorithm will be subject to change.
 * It is the base of how entry and exit nodes are selected.
 * Needs testing with more data.
 *
 * Currently it works like this:
 *
 * For every entry node there is an LIFO queue of its online state.
 * Every entry node also keeps LIFO queues of their failed/success pairings with exit nodes.
 *
 * 1. Pass checks if we have recently working entry - exit pairs or fresh ones.
 * - if none found
 * 2. Pass checks if we have non busy entry - exit pairs and choses randomly
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

  const onlineIds = entryIds.filter((id) => {
    const rel = reliabilities.get(id)!;
    return Reliability.isOnline(rel);
  });
  if (onlineIds.length === 0) {
    return { res: "error", reason: "no online entry nodes" };
  }

  ////
  // 1. Pass: gather all recently working combinations

  const workingEntryExits = onlineIds
    .map((entryId) => {
      const rel = reliabilities.get(entryId)!;
      // take all exit nodes and remove entry nodes, recent failures, ongoing requests
      const nonFailureIds = Array.from(exitNodes.keys()).filter(
        (exitId) =>
          exitId !== entryId && !Reliability.isCurrentlyFailure(rel, exitId)
      );
      return nonFailureIds.map((exitId) => ({
        entryNode: entryNodes.get(entryId)!,
        exitNode: exitNodes.get(exitId)!,
      }));
    })
    .flat();

  if (workingEntryExits.length > 0) {
    const el = randomEl(workingEntryExits);
    return { ...el, res: "ok" };
  }

  ////
  // 2. Pass: select reliable non busy node pair

  const nonBusyWreliabilityEntryExits = onlineIds
    .map((entryId) => {
      const rel = reliabilities.get(entryId)!;
      // take all exit nodes and remove entry nodes and currently busy nodes
      const nonbusyIds = Array.from(exitNodes.keys()).filter(
        (exitId) =>
          exitId !== entryId && !Reliability.isCurrentlyBusy(rel, exitId)
      );
      return nonbusyIds.map((exitId) => ({
        entryNode: entryNodes.get(entryId)!,
        exitNode: exitNodes.get(exitId)!,
        rel: Reliability.calculate(rel, exitId),
      }));
    })
    .flat()
    .filter(({ rel }) => rel > RELIABILITY_THRESHOLD);

  if (nonBusyWreliabilityEntryExits.length > 0) {
    const el = randomEl(nonBusyWreliabilityEntryExits);
    return { ...el, res: "ok" };
  }

  return { res: "error", reason: "no reliable idle entry - exit pair found" };
}

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
