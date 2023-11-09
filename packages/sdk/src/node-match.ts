import type { EntryNode } from './entry-node';
import type { ExitNode } from './exit-node';

// amount of history to keep
export const MaxSegmentsHistory = 30;
export const MaxMessagesHistory = 30;
export const MaxRequestsHistory = 20;
export const OngoingReqThreshold = 5;

export type NodeMatch = {
    entryNode: EntryNode;
    exitNode: ExitNode;
    counterOffset: number;
};
