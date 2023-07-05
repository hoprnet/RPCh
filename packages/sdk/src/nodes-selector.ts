import * as Reliability from './reliability';
import type { EntryNode, ExitNode } from './nodes-collector';

/**
 * This algorithm will be subject to change.
 * It is the base of how entry and exit nodes are selected.
 * Needs testing with more data.
 *
 * Currently it works like this:
 *
 * For every entry node there is an LIFO queue of its online state.
 * Every entry node also keeps LIFO queues of their failed/success pairings with exit nodes.
 * For now we just take all exitNodes, combine them with all entry nodes, remove all recent failures.
 *
 */
export default function({entryNodes, exitNodes, reliabilities} : { entryNodes: Map<string, EntryNode>, reliabilities: Map<string, Reliability.Reliability>, exitNodes: Map<string, ExitNode>} ): {entryNode: EntryNode, exitNode: ExitNode} | string {
    const entryIds = Array.from(entryNodes.keys());
    // 1. determine online entry nodes
    const onlineIds =entryIds.filter(function(id) {
        const rel = reliabilities.get(id)!;
        return Reliability.isOnline(rel);
    });

    // 2. gather all tryable entry - exit node pairs
    const entryExitSelection = onlineIds.map(function(entryId) {
        const rel = reliabilities.get(entryId)!;
        // take all exit nodes and remove recent failures
        const tryableIds = Array.from(exitNodes.keys()).filter(function(exitId) {
            return !Reliability.isCurrentlyFailure(rel, exitId);
        })
        return tryableIds.map(function(exitId) {
            return { entryNode: entryNodes.get(entryId)!, exitNode: exitNodes.get(exitId)!};
        })
    }).flat()

    if (entryExitSelection.length === 0) {
        return "

    // 6. give a random online node a chance of 1% to avoid total node starvation
    if (unusedOnlineIds.length > 0 && Math.random() < 0.01) {
      const id = randomEl(unusedOnlineIds);
      const entryNode = this.entryNodes.get(id)!;
    }
  };
}

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
