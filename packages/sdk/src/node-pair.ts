import * as EntryData from './entry-data';
import * as ExitData from './exit-data';
import * as ExitNode from './exit-node';
import * as NodeAPI from './node-api';
import * as NodeMatch from './node-match';
import * as Payload from './payload';
import * as PerfData from './perf-data';
import * as Request from './request';
import * as Res from './result';
import * as Segment from './segment';
import { average, logger, shortPeerId } from './utils';

import type { EntryNode } from './entry-node';

export type MessageListener = (messages: NodeAPI.Message[]) => void;

const MessagesFetchInterval = 333; // ms
const InfoResponseTimeout = 10e3; // 10s

const RelayNodesCompatVersions = ['2.0.4'];

export type NodePair = {
    entryNode: EntryNode;
    entryData: EntryData.EntryData;
    exitNodes: Map<string, ExitNode.ExitNode>;
    exitDatas: Map<string, ExitData.ExitData>;
    peers: string[]; // peerIds of potential relays
    relays: string[]; // peerIds of potential relays
    applicationTag: number;
    hops?: number;
    messageListener: MessageListener;
    fetchTimeout?: ReturnType<typeof setTimeout>;
    infoTimeout?: ReturnType<typeof setTimeout>;
    fetchMessagesOngoing: boolean;
    log: ReturnType<typeof logger>;
    forceManualRelaying: boolean;
};

export function create(
    entryNode: EntryNode,
    exitNodes: ExitNode.ExitNode[],
    applicationTag: number,
    messageListener: MessageListener,
    hops: number,
    forceManualRelaying: boolean,
): NodePair {
    const entryData = EntryData.create();
    const shortId = shortPeerId(entryNode.id);
    const log = logger(['sdk', `nodepair${shortId}(${entryNode.apiEndpoint})`]);
    const exitNodesMap = new Map(exitNodes.map((n) => [n.id, n]));
    const exitDatasMap = new Map(exitNodes.map((n) => [n.id, ExitData.create()]));
    return {
        entryNode,
        entryData,
        exitNodes: exitNodesMap,
        exitDatas: exitDatasMap,
        peers: [],
        relays: [],
        applicationTag,
        messageListener,
        fetchMessagesOngoing: false,
        log,
        hops,
        forceManualRelaying,
    };
}

export function addExitNodes(np: NodePair, exitNodes: ExitNode.ExitNode[]) {
    exitNodes.forEach((x) => {
        if (!np.exitNodes.has(x.id)) {
            np.exitNodes.set(x.id, x);
            np.exitDatas.set(x.id, ExitData.create());
        }
    });
}

export function removeExitNode(np: NodePair, xId: string) {
    np.exitNodes.delete(xId);
    np.exitDatas.delete(xId);
}

export function destruct(np: NodePair) {
    clearTimeout(np.fetchTimeout);
    np.fetchTimeout = undefined;
}

export function id(np: NodePair) {
    return np.entryNode.id;
}

export function requestStarted(np: NodePair, req: Request.Request) {
    const data = np.exitDatas.get(req.exitPeerId);
    if (!data) {
        np.log.error('started %s on missing exit data', Request.prettyPrint(req));
        return;
    }
    EntryData.addOngoingReq(np.entryData);
    ExitData.addOngoing(data, req);
    if (!np.fetchTimeout) {
        np.fetchTimeout = setTimeout(() => fetchMessages(np), MessagesFetchInterval);
    }
}

export function requestSucceeded(np: NodePair, req: Request.Request, responseTime: number) {
    const data = np.exitDatas.get(req.exitPeerId);
    if (!data) {
        np.log.error('successful %s on missing exit data', Request.prettyPrint(req));
        return;
    }

    EntryData.removeOngoingReq(np.entryData);
    ExitData.recSuccess(data, req, responseTime);
    checkStopInterval(np);
}

export function requestFailed(np: NodePair, req: Request.Request) {
    const data = np.exitDatas.get(req.exitPeerId);
    if (!data) {
        np.log.error('failed %s on missing exit data', Request.prettyPrint(req));
        return;
    }

    EntryData.removeOngoingReq(np.entryData);
    ExitData.recFailed(data, req);
    checkStopInterval(np);
}

function checkStopInterval(np: NodePair) {
    // stop interval if applicable
    if (np.entryData.requestsOngoing === 0 && np.entryData.infoOngoing === 0) {
        clearTimeout(np.fetchTimeout);
        np.fetchTimeout = undefined;
    }
}

export function segmentStarted(np: NodePair, seg: Segment.Segment) {
    EntryData.addOngoingSeg(np.entryData, seg);
}

export function segmentSucceeded(np: NodePair, seg: Segment.Segment, responseTime: number) {
    EntryData.recSuccessSeq(np.entryData, seg, responseTime);
}

export function segmentFailed(np: NodePair, seg: Segment.Segment) {
    EntryData.recFailureSeq(np.entryData, seg);
}

/**
 * Run initial discovery steps.
 * Request peers from entry node.
 * Request info msg from exit nodes.
 */
export function discover(np: NodePair) {
    const startPingTime = Date.now();
    if (np.hops === 0 || !np.forceManualRelaying) {
        NodeAPI.version(np.entryNode)
            .then(() => {
                np.entryData.pingDuration = Date.now() - startPingTime;
                np.log.verbose('version ping took %dms', np.entryData.pingDuration);
            })
            .catch((err) => {
                np.log.error('error fetching version: %s[%o]', JSON.stringify(err), err);
            });
    } else {
        NodeAPI.getPeers(np.entryNode)
            .then((r) => incPeers(np, r, startPingTime))
            .catch((err) => {
                np.log.error('error fetching peers: %s[%o]', JSON.stringify(err), err);
            });
    }
    Array.from(np.exitNodes.values()).map((x, idx) => {
        setTimeout(() => requestInfo(np, x), idx);
    });
}

function requestInfo(np: NodePair, exitNode: ExitNode.ExitNode) {
    const message = `info-${np.entryNode.id}-${np.hops ?? '_'}`;
    const exitData = np.exitDatas.get(exitNode.id);
    if (!exitData) {
        return np.log.error('missing exit data for %s before info req', exitNode.id);
    }
    exitData.infoLatStarted = Date.now();
    NodeAPI.sendMessage(
        {
            ...np.entryNode,
            hops: np.hops,
        },
        {
            recipient: exitNode.id,
            tag: np.applicationTag,
            message,
        },
    );
    EntryData.addOngoingInfo(np.entryData);
    if (!np.fetchTimeout) {
        np.fetchTimeout = setTimeout(() => fetchMessages(np), MessagesFetchInterval);
    }
    // stop checking for info resp at after this
    // will still be able to receive info resp if messages went over this route
    np.infoTimeout = setTimeout(() => {
        np.log.warn(
            'timeout (%dms) waiting for info response from x%s',
            InfoResponseTimeout,
            shortPeerId(exitNode.id),
        );
        EntryData.removeOngoingInfo(np.entryData);
        checkStopInterval(np);
        const exitData = np.exitDatas.get(exitNode.id);
        if (!exitData) {
            return np.log.error(
                'missing exit data for x%s during info resp timeout',
                shortPeerId(exitNode.id),
            );
        }
        exitData.infoFail = true;
    }, InfoResponseTimeout);
}

export function prettyPrint(np: NodePair): string {
    const segOngoing = np.entryData.segmentsOngoing.length;
    const segTotal = np.entryData.segmentsHistory.length;
    const segLats = Array.from(np.entryData.segments.values()).reduce<number[]>((acc, sd) => {
        if (PerfData.isSuccess(sd)) {
            acc.push(sd.latency);
        }
        return acc;
    }, []);

    const exCount = np.exitNodes.size;
    const exStrs = Array.from(np.exitDatas).map(([id, d]) => {
        const v = d.version;
        const ctrOff = d.counterOffset?.toFixed(0) || 0;
        const info = d.infoFail ? 'fail' : `${d.infoLatMs?.toFixed(0)}ms`;
        const o = d.requestsOngoing.length;
        const tot = d.requestsHistory.length;
        const lats = Array.from(d.requests.values()).reduce<number[]>((acc, rd) => {
            if (PerfData.isSuccess(rd)) {
                acc.push(rd.latency);
            }
            return acc;
        }, []);
        const str = prettyOngoingNumbers(np, o, lats.length, tot, average(lats));
        const nId = shortPeerId(id);
        return `${nId}[v${v},o:${ctrOff}ms,i:${info},${str}]`;
    });
    const segStr = prettyOngoingNumbers(np, segOngoing, segLats.length, segTotal, average(segLats));
    const mesLat = average(np.entryData.fetchMessagesLatencies);
    const mesSuc = np.entryData.fetchMessagesSuccesses;
    const mesTot = mesSuc + np.entryData.fetchMessagesErrors;
    const mesStr = prettyOngoingNumbers(np, 0, mesSuc, mesTot, mesLat);
    const ping = np.entryData.pingDuration ? `${np.entryData.pingDuration}ms` : '..';
    return `${shortPeerId(
        id(np),
    )}[ping: ${ping}, seg: ${segStr}, msgs: ${mesStr}, ${exCount}x: ${exStrs.join(', ')}]`;
}

function prettyOngoingNumbers(
    np: NodePair,
    ongoing: number,
    successes: number,
    total: number,
    average: number,
) {
    if (total === 0) {
        if (ongoing === 0) {
            return '0';
        }
        return `0+${ongoing}`;
    }
    const sDone = `${successes}(${average.toFixed(0)}ms)/${total}`;
    if (ongoing === 0) {
        return sDone;
    }
    return `${sDone}+${ongoing}`;
}

function fetchMessages(np: NodePair) {
    const bef = Date.now();
    NodeAPI.retrieveMessages(np.entryNode, np.applicationTag)
        .then(({ messages }) => {
            const lat = Date.now() - bef;
            np.entryData.fetchMessagesSuccesses++;
            np.entryData.fetchMessagesLatencies.push(lat);
            if (np.entryData.fetchMessagesLatencies.length > NodeMatch.MaxMessagesHistory) {
                np.entryData.fetchMessagesLatencies.shift();
            }
            const { msgs, infoResps } = messages.reduce<{
                msgs: NodeAPI.Message[];
                infoResps: NodeAPI.Message[];
            }>(
                (acc, m) => {
                    if (m.body.startsWith('nfrp-')) {
                        acc.infoResps.push(m);
                    } else {
                        acc.msgs.push(m);
                    }
                    return acc;
                },
                { infoResps: [], msgs: [] },
            );
            incInfoResps(np, infoResps);
            np.messageListener(msgs);
        })
        .catch((err) => {
            np.log.error('error fetching node messages: %s[%o]', JSON.stringify(err), err);
            np.entryData.fetchMessagesErrors++;
        })
        .finally(() => {
            // if not canceled fetch again
            if (np.fetchTimeout) {
                np.fetchTimeout = setTimeout(() => fetchMessages(np), MessagesFetchInterval);
            }
        });
}

function incInfoResps(np: NodePair, infoResps: NodeAPI.Message[]) {
    infoResps.forEach(({ body }) => {
        const idx = body.indexOf('-');
        const payload = body.slice(idx + 1);
        const resDec = Payload.decodeInfo(payload);
        if (Res.isErr(resDec)) {
            return np.log.error('error decoding info payload:', resDec.error);
        }
        const { peerId, version, counter, shRelays } = resDec.res;
        // keeping it backwards compatible
        const shortRelays = shRelays ?? [];
        const nodeLog = ExitNode.prettyPrint(peerId, version, counter, shortRelays);
        const exitNode = np.exitNodes.get(peerId);
        if (!exitNode) {
            return np.log.info('info response for missing exit node %s', nodeLog);
        }
        const exitData = np.exitDatas.get(peerId);
        if (!exitData) {
            return np.log.error('info response missing exit data %s', nodeLog);
        }
        np.log.verbose('got exit node info: %s', nodeLog);
        exitData.version = version;
        exitData.counterOffset = Date.now() - counter;
        exitData.infoLatMs = exitData.infoLatStarted && Date.now() - exitData.infoLatStarted;
        exitData.infoFail = false;
        exitData.shRelays = shortRelays;
        EntryData.removeOngoingInfo(np.entryData);
        clearTimeout(np.infoTimeout);
        np.infoTimeout = undefined;
    });
    checkStopInterval(np);
}

function incPeers(np: NodePair, res: NodeAPI.Peers | NodeAPI.NodeError, startPingTime: number) {
    if (NodeAPI.isError(res)) {
        np.log.error('error node internal: %o', res);
        return;
    }

    // available peers
    const peers = res.connected
        .filter(({ reportedVersion }) =>
            RelayNodesCompatVersions.some((v) => reportedVersion.startsWith(v)),
        )
        .map(({ peerId, peerAddress }) => ({ peerId, peerAddress }));
    NodeAPI.getNodeChannels(np.entryNode)
        .then((ch) => {
            incChannels(np, ch, peers, startPingTime);
        })
        .catch((err) => {
            np.log.error('error fetching channels: %s[%o]', JSON.stringify(err), err);
        });
}

function incChannels(
    np: NodePair,
    channels: NodeAPI.NodeChannels,
    peers: { peerId: string; peerAddress: string }[],
    startPingTime: number,
) {
    np.entryData.pingDuration = Date.now() - startPingTime;
    np.log.verbose('channel ping took %dms', np.entryData.pingDuration);

    // open channels
    const openChannelsArr = channels.outgoing
        .filter(({ status }) => status === 'Open')
        .map(({ peerAddress }) => peerAddress);
    const openChannels = new Set(openChannelsArr);
    np.peers = peers.map(({ peerId }) => peerId);
    np.relays = peers
        .filter(({ peerAddress }) => openChannels.has(peerAddress))
        .map(({ peerId }) => peerId);
    np.log.verbose('found %d potential relays', np.relays.length);
}
