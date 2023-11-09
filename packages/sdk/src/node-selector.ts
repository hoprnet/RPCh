import * as EntryData from './entry-data';
import * as ExitData from './exit-data';
import * as NodeMatch from './node-match';
import * as NodePair from './node-pair';
import * as Res from './result';
import type { EntryNode } from './entry-node';
import { shortPeerId, randomEl } from './utils';

const ExitNodesCompatVersions = ['0.11'];

export type NodeSelection = {
    match: NodeMatch.NodeMatch;
    via: string;
};

type EntryPerf = EntryData.Perf & { entryNode: EntryNode };
type ExitPerf = ExitData.Perf & NodeMatch.NodeMatch;

/**
 * Try to distribute evenly with best route pairs preferred.
 *
 */
export function routePair(nodePairs: Map<string, NodePair.NodePair>): Res.Result<NodeSelection> {
    const routePerfs = createRoutePerfs(nodePairs);
    return match(nodePairs, routePerfs);
}

/**
 * Try to distribute evenly with best route pairs preferred.
 * Exclude node match entry node from search.
 *
 */
export function fallbackRoutePair(
    nodePairs: Map<string, NodePair.NodePair>,
    exclude: EntryNode,
): Res.Result<NodeSelection> {
    const routePerfs = createRoutePerfs(nodePairs);
    const filtered = routePerfs.filter(({ entryNode }) => entryNode.id !== exclude.id);
    return match(nodePairs, filtered);
}

export function prettyPrint(res: Res.Result<NodeSelection>) {
    if (Res.isOk(res)) {
        const sel = res.res;
        const eId = shortPeerId(sel.match.entryNode.id);
        const xId = shortPeerId(sel.match.exitNode.id);
        return `${eId} > ${xId} (via ${sel.via})`;
    }
    return `${res.error}`;
}

function match(
    nodePairs: Map<string, NodePair.NodePair>,
    routePerfs: ExitPerf[],
): Res.Result<NodeSelection> {
    // special case no nodes
    if (routePerfs.length === 0) {
        return Res.err('no nodes');
    }
    // special case only one route
    if (routePerfs.length === 1) {
        return success(routePerfs[0], 'only route available');
    }

    // special case version mismatches
    const xVersionMatches = versionMatches(routePerfs);
    if (xVersionMatches.length === 1) {
        return success(xVersionMatches[0], 'only (assumed) version match');
    }
    if (xVersionMatches.length === 0) {
        return Res.err('no nodes matching required version');
    }

    ////
    // 1. compare exit node performances
    const xNoInfoFails = noInfoFails(xVersionMatches);
    if (xNoInfoFails.length === 1) {
        return success(xNoInfoFails[0], 'only info req success');
    }
    const xLeastErrs = leastReqErrors(xNoInfoFails);
    if (xLeastErrs.length === 1) {
        return success(xLeastErrs[0], 'least request errors');
    }
    const xLeastOngoing = leastReqOngoing(xLeastErrs);
    if (xLeastOngoing.length === 1) {
        return success(xLeastOngoing[0], 'least ongoing requests');
    }
    const xBestLats = bestReqLatencies(xLeastOngoing);
    if (xBestLats.length > 0) {
        return success(xBestLats[0], 'best request latency');
    }
    const xBestInfoLats = bestInfoLatencies(xLeastOngoing);
    if (xBestInfoLats.length > 0) {
        return success(xBestInfoLats[0], 'best info req latency');
    }

    const entryPerfs = createEntryPerfs(nodePairs, xLeastOngoing);

    ////
    // 2. compare entry node performances
    const eLeastErrs = leastSegErrors(entryPerfs);
    if (eLeastErrs.length === 1) {
        return eSuccess(eLeastErrs[0], xLeastOngoing, 'least segment errors');
    }
    const eLeastOngoing = leastSegOngoing(eLeastErrs);
    if (eLeastOngoing.length === 1) {
        return eSuccess(eLeastOngoing[0], xLeastOngoing, 'least ongoing segments');
    }
    const eBestLats = bestSegLatencies(eLeastOngoing);
    if (eBestLats.length > 0) {
        return eSuccess(eBestLats[0], xLeastOngoing, 'best segment latency');
    }
    const eLeastMsgsErrs = leastMsgsErrors(eLeastOngoing);
    if (eLeastMsgsErrs.length === 1) {
        return eSuccess(eLeastMsgsErrs[0], xLeastOngoing, 'least message retrieval errors');
    }
    const eBestMsgsLats = bestMsgsLatencies(eLeastMsgsErrs);
    if (eBestMsgsLats.length > 0) {
        return eSuccess(eBestMsgsLats[0], xLeastOngoing, 'best message retrieval latency');
    }

    ////
    // 3. compare ping speed
    const eQuickestPing = quickestPing(eLeastMsgsErrs);
    if (eQuickestPing.length > 0) {
        return eSuccess(eQuickestPing[0], xLeastOngoing, 'quickest version ping');
    }

    return { success: false, error: 'insufficient data' };
}

function success(
    { entryNode, exitNode, counterOffset }: ExitPerf,
    via: string,
): Res.Result<NodeSelection> {
    return Res.ok({
        match: { entryNode, exitNode, counterOffset },
        via,
    });
}

function createRoutePerfs(nodePairs: Map<string, NodePair.NodePair>) {
    return Array.from(nodePairs.values()).reduce<ExitPerf[]>((acc, np) => {
        const perfs = Array.from(np.exitDatas).map(([xId, xd]) => ({
            ...ExitData.perf(xd),
            entryNode: np.entryNode,
            exitNode: np.exitNodes.get(xId)!,
        }));
        return acc.concat(perfs);
    }, []);
}

function noInfoFails(routePerfs: ExitPerf[]): ExitPerf[] {
    // boolean sort: false first
    routePerfs.sort((l, r) => {
        if (l.infoFail === r.infoFail) {
            return 0;
        }
        if (l.infoFail) {
            return 1;
        }
        return -1;
    });
    const idx = routePerfs.findIndex(({ infoFail }) => infoFail);
    if (idx > 0) {
        return routePerfs.slice(0, idx);
    }
    return routePerfs;
}

function versionMatches(routePerfs: ExitPerf[]): ExitPerf[] {
    return routePerfs.filter(({ version }) => {
        if (version) {
            return ExitNodesCompatVersions.some((v) => version.startsWith(v));
        }
        // do not exclude not yet determined ones
        return true;
    });
}

function leastReqErrors(routePerfs: ExitPerf[]): ExitPerf[] {
    routePerfs.sort((l, r) => l.failures - r.failures);
    const min = routePerfs[0].failures;
    const idx = routePerfs.findIndex(({ failures }) => min < failures);
    if (idx > 0) {
        return routePerfs.slice(0, idx);
    }
    return routePerfs;
}

function bestReqLatencies(routePerfs: ExitPerf[]): ExitPerf[] {
    const haveLats = routePerfs.filter(({ avgLats }) => avgLats > 0);
    haveLats.sort((l, r) => l.avgLats - r.avgLats);
    return haveLats;
}

function bestInfoLatencies(routePerfs: ExitPerf[]): ExitPerf[] {
    const haveLats = routePerfs.filter(({ infoLat }) => infoLat > 0);
    haveLats.sort((l, r) => l.infoLat - r.infoLat);
    return haveLats;
}

function leastReqOngoing(routePerfs: ExitPerf[]): ExitPerf[] {
    routePerfs.sort((l, r) => l.ongoing - r.ongoing);
    const min = routePerfs[0].ongoing;
    const idx = routePerfs.findIndex(({ ongoing }) => min < ongoing);
    if (idx > 0) {
        return routePerfs.slice(0, idx);
    }
    return routePerfs;
}

function eSuccess(
    { entryNode }: EntryPerf,
    routePerfs: ExitPerf[],
    via: string,
): Res.Result<NodeSelection> {
    const xPerfs = routePerfs.filter(({ entryNode: en }) => en.id === entryNode.id);
    const el = randomEl(xPerfs);
    return Res.ok({
        match: { entryNode, exitNode: el.exitNode, counterOffset: el.counterOffset },
        via,
    });
}

function createEntryPerfs(
    nodePairs: Map<string, NodePair.NodePair>,
    routePerfs: ExitPerf[],
): EntryPerf[] {
    const entryNodes = routePerfs.map(({ entryNode }) => entryNode);
    return Array.from(new Set(entryNodes)).map((entryNode) => {
        const ed = nodePairs.get(entryNode.id)!.entryData;
        return {
            ...EntryData.perf(ed),
            entryNode,
        };
    });
}

function leastSegErrors(entryPerfs: EntryPerf[]): EntryPerf[] {
    entryPerfs.sort((l, r) => l.segFailures - r.segFailures);
    const min = entryPerfs[0].segFailures;
    const idx = entryPerfs.findIndex(({ segFailures }) => min < segFailures);
    if (idx > 0) {
        return entryPerfs.slice(0, idx);
    }
    return entryPerfs;
}

function bestSegLatencies(entryPerfs: EntryPerf[]): EntryPerf[] {
    const haveLats = entryPerfs.filter(({ segAvgLats }) => segAvgLats > 0);
    haveLats.sort((l, r) => l.segAvgLats - r.segAvgLats);
    return haveLats;
}

function leastSegOngoing(entryPerfs: EntryPerf[]): EntryPerf[] {
    entryPerfs.sort((l, r) => l.segOngoing - r.segOngoing);
    const min = entryPerfs[0].segOngoing;
    const idx = entryPerfs.findIndex(({ segOngoing }) => min < segOngoing);
    if (idx > 0) {
        return entryPerfs.slice(0, idx);
    }
    return entryPerfs;
}

function leastMsgsErrors(entryPerfs: EntryPerf[]): EntryPerf[] {
    entryPerfs.sort((l, r) => l.msgsFails - r.msgsFails);
    const min = entryPerfs[0].msgsFails;
    const idx = entryPerfs.findIndex(({ msgsFails }) => min < msgsFails);
    if (idx > 0) {
        return entryPerfs.slice(0, idx);
    }
    return entryPerfs;
}

function bestMsgsLatencies(entryPerfs: EntryPerf[]): EntryPerf[] {
    const haveLats = entryPerfs.filter(({ msgsAvgLats }) => msgsAvgLats > 0);
    haveLats.sort((l, r) => l.msgsAvgLats - r.msgsAvgLats);
    return haveLats;
}

function quickestPing(entryPerfs: EntryPerf[]): EntryPerf[] {
    const havePing = entryPerfs.filter(({ pingDuration }) => pingDuration > 0);
    havePing.sort((l, r) => l.pingDuration - r.pingDuration);
    return havePing;
}
