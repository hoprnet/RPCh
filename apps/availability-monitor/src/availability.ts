import { NodeAPI, Utils } from '@rpch/sdk';
import * as q from './query';
import * as PeersCache from './peers-cache';

import type { Pool } from 'pg';

const log = Utils.logger(['availability-monitor:availability']);
const ApplicationTag = 0xffff;

export async function start(dbPool: Pool) {
    dbPool.on('error', (err, client) => log.error('pg pool [client %s]: %o', client, err));
    dbPool.connect();
    run(dbPool);
}

async function run(dbPool: Pool) {
    try {
        const entryNodes = await q.entryNodes(dbPool);
        const exitNodes = await q.exitNodes(dbPool);

        if (!entryNodes || entryNodes.length === 0) {
            log.error('no entry nodes');
        } else if (!exitNodes || exitNodes.length === 0) {
            log.error('no exit nodes');
        } else {
            await doRun(dbPool, entryNodes, exitNodes);
        }
    } catch (err) {
        log.error('run main loop: %o', err);
    } finally {
        reschedule(dbPool);
    }
}

function reschedule(dbPool: Pool) {
    // schedule new run every min 30sec and max 10 min
    const next = 30e3 + Math.floor(Math.random() * 9.5 * 60e3);
    const logM = Math.floor(next / 1000 / 60);
    const logS = Math.round(next / 1000) - logM * 60;
    log.info('scheduling next run in %dm%ds', logM, logS);
    setTimeout(() => run(dbPool), next);
}

async function doRun(
    dbPool: Pool,
    allEntryNodes: q.RegisteredNode[],
    allExitNodes: q.RegisteredNode[]
) {
    // gather peers for entry nodes
    const peersCache: PeersCache.PeersCache = PeersCache.init();
    const { peers: entryPeers, expectedOffline: offlineEntries } = await peersMap(
        peersCache,
        allEntryNodes
    );
    const entryNodes = allEntryNodes.filter(
        ({ id }) => !offlineEntries.some(({ id: off }) => id === off)
    );
    const missingOnlineEntries = entryNodes.filter(({ id }) => !entryPeers.has(id));

    // gather peers for exit nodes
    const { peers: exitPeers, expectedOffline: offlineExits } = await peersMap(
        peersCache,
        allExitNodes
    );
    const exitNodes = allExitNodes.filter(
        ({ id }) => !offlineExits.some(({ id: off }) => id === off)
    );
    const missingOnlineExits = exitNodes.filter(({ id }) => !exitPeers.has(id));

    // zero hop
    const zhPairs = zeroHop(entryPeers, exitPeers);

    // gather channels for one hop
    const onlineEntryNodes = entryNodes.filter(({ id }) => entryPeers.has(id));
    const channels = await gatherChannels(onlineEntryNodes);

    // one hop
    const ohRelPairs = oneHop(channels, entryPeers, exitPeers);

    // determine online exit applications
    const eIds: [string, q.RegisteredNode][] = entryNodes
        .filter(({ id }) => entryPeers.has(id))
        .map((n) => [n.id, n]);
    const xIds: [string, q.RegisteredNode][] = exitNodes
        .filter(({ id }) => exitPeers.has(id))
        .map((n) => [n.id, n]);
    const nodes = new Map(eIds.concat(xIds));
    const onlineExitAppIds = await runOnlineChecks(exitPeers, nodes);

    const zhOnline = filterOnline(zhPairs, onlineExitAppIds);
    const ohOnline = filterOnline(ohRelPairs, onlineExitAppIds);
    const offExitApps = exitNodes.filter(({ id }) => !onlineExitAppIds.has(id));
    const onlineExitNodes = exitNodes.filter(({ id }) => exitPeers.has(id));

    // write zero hops
    const zhPairIds = toPairings(zhOnline);
    await q.writeZeroHopPairings(dbPool, zhPairIds);

    // write one hops
    // const ohMax = entries.length * exits.length * (entries.length + exits.length - 2);
    const ohPairIds = toPairings(ohOnline);
    await q.writeOneHopPairings(dbPool, ohPairIds);

    // inform about expected offline nodes
    if (offlineEntries.length > 0 || offlineExits.length > 0) {
        log.info(
            '%d entry nodes and %d exit nodes appear offline intentionally:',
            offlineEntries.length,
            offlineExits.length
        );
        offlineEntries.map((n, idx) =>
            log.info('offline entry node %d: %s', idx + 1, q.prettyPrint(n))
        );
        offlineExits.map((n, idx) =>
            log.info('offline exit node %d: %s', idx + 1, q.prettyPrint(n))
        );
    }

    // complain about offline peers
    if (missingOnlineEntries.length > 0) {
        log.warn('missing %d/%d online entry nodes:', missingOnlineEntries.length, entryPeers.size);
        missingOnlineEntries.map((n, idx) =>
            log.warn('missing online entry node %d: %s', idx + 1, q.prettyPrint(n))
        );
    }
    if (missingOnlineExits.length > 0) {
        log.warn('missing %d/%d online exit nodes:', missingOnlineExits.length, exitPeers.size);
        missingOnlineExits.map((n, idx) =>
            log.warn('missing online exit node %d: %s', idx + 1, q.prettyPrint(n))
        );
    }
    if (offExitApps.length > 0) {
        log.warn('missing %d/%d online exit applications:', offExitApps.length, exitPeers.size);
        offExitApps.map((n, idx) =>
            log.warn('missing online exit application %d: %s', idx + 1, q.prettyPrint(n))
        );
    }
    logHopRoutes('zero hop', zhOnline, onlineEntryNodes, onlineExitNodes);
    logHopRoutes('one hop', ohOnline, onlineEntryNodes, onlineExitNodes);
}

function zeroHop(
    entryPeers: Map<string, Set<string>>,
    exitPeers: Map<string, Set<string>>
): Map<string, Set<string>> {
    // determine exit nodes reachable by their peers
    const peersExits = revertMap(exitPeers);

    // match routes
    return Array.from(entryPeers).reduce<Map<string, Set<string>>>((acc, [entryId, peers]) => {
        const exits = peersExits.get(entryId);
        if (exits) {
            const filteredPeers = [...peers].filter((p) => exits.has(p));
            acc.set(entryId, new Set(filteredPeers));
        }
        return acc;
    }, new Map());
}

function oneHop(
    channels: Map<string, Set<string>>,
    entryPeers: Map<string, Set<string>>,
    exitPeers: Map<string, Set<string>>
): Map<string, Set<string>> {
    // match channels with peers
    const channelEntryPeers = filterChannels(entryPeers, channels);

    // determine exit nodes reachable by their peers
    const channelExitPeers = filterChannels(exitPeers, channels);
    const peersExits = revertMap(exitPeers);

    return Array.from(channelEntryPeers).reduce<Map<string, Set<string>>>((acc, [eId, ePeers]) => {
        // exits reachable via channeled peers
        const resExitsArr = Array.from(ePeers).map<string[]>((pId) => {
            const exits = peersExits.get(pId);
            if (exits) {
                return [...exits];
            }
            return [];
        });

        const exits = new Set(resExitsArr.flat());

        // at this point we know which exits are reachable from this entry
        // going to filter those exits further by determining if they have a valid return path
        const exitsArr = Array.from(exits).filter((xId) => {
            const chPs = channelExitPeers.get(xId);
            if (!chPs) {
                return false;
            }
            const peers = entryPeers.get(eId);
            if (!peers) {
                return false;
            }
            return !!Array.from(chPs).find((pId) => peers.has(pId));
        });

        acc.set(eId, new Set(exitsArr));
        return acc;
    }, new Map());
}

async function peersMap(
    peersCache: PeersCache.PeersCache,
    nodes: q.RegisteredNode[]
): Promise<{ peers: Map<string, Set<string>>; expectedOffline: q.RegisteredNode[] }> {
    const pRaw = nodes.map(async (node) => {
        let nodePeers;
        try {
            nodePeers = await PeersCache.fetchPeers(peersCache, node);
        } catch (err: any) {
            // node is expectedly offline and does not warrent a warning log
            if (err.cause && err.cause.errno === -3008 && err.cause.code === 'ENOTFOUND') {
                return { expectedOffline: node };
            }
            log.warn('fetch peers from %s: %o', node.id, err);
        }
        if (PeersCache.isOnline(nodePeers)) {
            const ids = Array.from(nodePeers.peers.values()).map(({ peerId }) => peerId);
            return { nodeId: node.id, peerIds: new Set(ids) };
        }
        return Promise.reject();
    });

    const raw = await Promise.allSettled(pRaw);
    const successes = raw.filter((val) => val.status === 'fulfilled' && !!val.value) as [
        {
            status: 'fulfilled';
            value: { expectedOffline: q.RegisteredNode } | { nodeId: string; peerIds: Set<string> };
        }
    ];
    return successes.reduce<{
        peers: Map<string, Set<string>>;
        expectedOffline: q.RegisteredNode[];
    }>(
        (acc, { value }) => {
            if ('expectedOffline' in value) {
                acc.expectedOffline.push(value.expectedOffline);
            } else {
                acc.peers.set(value.nodeId, value.peerIds);
            }
            return acc;
        },
        { peers: new Map(), expectedOffline: [] }
    );
}

async function runOnlineChecks(
    exitPeers: Map<string, Set<string>>,
    nodes: Map<string, q.RegisteredNode>
): Promise<Set<string>> {
    const messagePreps: Map<string, { eNode: q.RegisteredNode; exitIds: Set<string> }> = Array.from(
        exitPeers.keys()
    ).reduce((acc, xId) => {
        const peerIds = Array.from(exitPeers.get(xId) as Set<string>).filter((pId) =>
            nodes.has(pId)
        );
        if (peerIds.length > 0) {
            const peerId = randomEl(peerIds);
            const eNode = nodes.get(peerId) as q.RegisteredNode;
            if (acc.has(peerId)) {
                acc.get(peerId).exitIds.add(xId);
            } else {
                acc.set(peerId, { eNode, exitIds: new Set([xId]) });
            }
        }
        return acc;
    }, new Map());

    const pPongs = Array.from(messagePreps).map(async ([eId, { eNode, exitIds }]) => {
        const conn = {
            apiEndpoint: new URL(eNode.hoprd_api_endpoint),
            accessToken: eNode.hoprd_api_token,
        };
        // delete any previous pongs
        await NodeAPI.deleteMessages(conn, ApplicationTag).catch((err) =>
            log.error('delete messages from %s: %o', Utils.shortPeerId(eId), err)
        );

        // send pings
        const pPings = Array.from(exitIds.values()).map((xId, idx) => {
            // give it some delay to not affect the nodes performance too much
            const delay = idx * 11;
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    NodeAPI.sendMessage(
                        { ...conn, hops: 0 },
                        { tag: ApplicationTag, recipient: xId, message: `ping-${eId}` }
                    )
                        .then(resolve)
                        .catch((err) => {
                            log.error(
                                'send ping from %s to %s: %o',
                                Utils.shortPeerId(eId),
                                Utils.shortPeerId(xId),
                                err
                            );
                            reject('Error sending ping');
                        });
                }, delay);
            });
        });

        await Promise.all(pPings).catch((err) => {
            log.warn('some ping messages failed: %s', err);
        });

        // receive pongs (give 5 sec grace period)
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                NodeAPI.retrieveMessages(conn, ApplicationTag)
                    .then(resolve)
                    .catch((err) => {
                        log.error(
                            'retrieve messages from %s: %o',
                            JSON.stringify(Utils.shortPeerId(eId)),
                            err
                        );
                        reject('Error retrieving messages');
                    });
            }, 5e3);
        });
    });

    const results = (await Promise.allSettled(pPongs)) as PromiseSettledResult<{
        messages: NodeAPI.Message[];
    }>[];
    const filteredRes = results.filter((pRes) => pRes.status === 'fulfilled') as [
        { status: 'fulfilled'; value: { messages: NodeAPI.Message[] } }
    ];
    const msgs = filteredRes.map(({ value }) => value.messages).flat();
    const onlineXids = msgs
        .map(({ body: pong }) => {
            if (pong.startsWith('pong-')) {
                const [, xId] = pong.split('-');
                return xId;
            }
        })
        .filter((x) => !!x) as unknown as Set<string>;
    return new Set(onlineXids);
}

function channelsMap(channels: NodeAPI.Channel[]): Map<string, Set<string>> {
    return channels.reduce((acc, { sourcePeerId, destinationPeerId }) => {
        if (acc.has(sourcePeerId)) {
            acc.get(sourcePeerId).add(destinationPeerId);
        } else {
            acc.set(sourcePeerId, new Set([destinationPeerId]));
        }
        return acc;
    }, new Map());
}

function revertMap<K, V>(map: Map<K, Set<V>>): Map<V, Set<K>> {
    return Array.from(map).reduce((acc, [id, vals]) => {
        vals.forEach((v) => {
            if (acc.has(v)) {
                acc.get(v).add(id);
            } else {
                acc.set(v, new Set([id]));
            }
        });
        return acc;
    }, new Map());
}

function logHopRoutes(
    prefix: string,
    pairs: Map<string, Set<string>>,
    entryNodes: q.RegisteredNode[],
    exitNodes: q.RegisteredNode[]
) {
    const countPairs = Array.from(pairs).reduce((acc, [_eId, xIds]) => acc + xIds.size, 0);
    const max = entryNodes.length * exitNodes.length;

    log.info(
        'found %d/%d %s routes connecting %d entries with %d exits',
        countPairs,
        max,
        prefix,
        entryNodes.length,
        exitNodes.length
    );

    const allPairs = entryNodes.reduce<[q.RegisteredNode, q.RegisteredNode][]>((acc, eNode) => {
        return acc.concat(exitNodes.map((xNode) => [eNode, xNode]));
    }, []);

    allPairs.reduce<number>((acc, [eNode, xNode]) => {
        const exitIds = pairs.get(eNode.id);
        if (!exitIds || !exitIds.has(xNode.id)) {
            log.info(
                'missing %s route %d: %s -> %s',
                prefix,
                acc + 1,
                q.prettyPrint(eNode),
                q.prettyPrint(xNode)
            );
            return acc + 1;
        }
        return acc;
    }, 0);
}

function filterChannels(
    peers: Map<string, Set<string>>,
    channels: Map<string, Set<string>>
): Map<string, Set<string>> {
    return Array.from(peers).reduce((acc, [id, prs]) => {
        const chans = channels.get(id);
        if (chans) {
            const vals = [...prs].filter((x) => chans.has(x));
            acc.set(id, new Set(vals));
        }
        return acc;
    }, new Map());
}

function filterOnline(
    pairs: Map<string, Set<string>>,
    online: Set<string>
): Map<string, Set<string>> {
    return Array.from(pairs).reduce((acc, [eId, xIds]) => {
        const vals = new Set(Array.from(xIds).filter((x) => online.has(x)));
        if (vals.size > 0) {
            acc.set(eId, vals);
        }
        return acc;
    }, new Map());
}

// expand to entryId -> exitId routes struct
function toPairings(pairsMap: Map<string, Set<string>>): q.Pair[] {
    return Array.from(pairsMap).reduce<q.Pair[]>((acc, [entryId, exitIds]) => {
        exitIds.forEach((exitId) => {
            acc.push({ entryId, exitId });
        });
        return acc;
    }, []);
}

async function gatherChannels(entryNodes: q.RegisteredNode[]): Promise<Map<string, Set<string>>> {
    if (entryNodes.length === 0) {
        return new Map();
    }
    const entryNode = randomEl(entryNodes);
    const respCh = await NodeAPI.getAllChannels({
        apiEndpoint: new URL(entryNode.hoprd_api_endpoint),
        accessToken: entryNode.hoprd_api_token,
    }).catch((err) => {
        log.error('error getting channels from %s: %o', entryNode.id, err);
    });
    if (respCh) {
        return channelsMap(respCh.all);
    } else {
        const remaining = entryNodes.filter((e) => e !== entryNode);
        return gatherChannels(remaining);
    }
}

function randomEl<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
