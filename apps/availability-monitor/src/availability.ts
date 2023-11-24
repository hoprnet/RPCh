import { NodeAPI, Utils } from '@rpch/sdk';
import * as q from './query';
import * as PeersCache from './peers-cache';

import type { Pool } from 'pg';

const log = Utils.logger(['availability-monitor:availability']);
const ApplicationTag = 0xffff;

type PeersCache = Map<string, Map<string, NodeAPI.Peer>>; // node id -> peer id -> Peer

export async function start(dbPool: Pool) {
    dbPool.on('error', (err, client) =>
        log.error('pg pool [client %s]: %s[%o]', client, JSON.stringify(err), err),
    );
    dbPool.connect();
    run(dbPool);
}

async function run(dbPool: Pool) {
    const pEntryNodes = q.entryNodes(dbPool);
    const pExitNodes = q.exitNodes(dbPool);
    try {
        const [entries, exits] = await Promise.all([pEntryNodes, pExitNodes]);
        if (entries.length === 0) {
            log.warn('no entry nodes');
        } else if (exits.length === 0) {
            log.warn('no exit nodes');
        } else {
            const peersCache: PeersCache.PeersCache = new Map();
            // await runZeroHops(dbPool, peersCache, qEntries.rows, qExits.rows);
            await runOneHops(dbPool, peersCache, entries, exits);
        }
    } catch (err) {
        log.error('run main loop: %s[%o]', JSON.stringify(err), err);
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

async function runZeroHops(
    dbPool: Pool,
    peersCache: PeersCache.PeersCache,
    entryNodes: q.RegisteredNode[],
    exitNodes: q.RegisteredNode[],
) {
    const entryPeers = await peersMap(peersCache, entryNodes);

    // gather exit peers and determine exit nodes reachable by their peers
    const exitPeers = await peersMap(peersCache, exitNodes);
    const peersExits = revertMap(exitPeers);

    // match routes
    const pairsMap = Array.from(entryPeers.entries()).reduce<Map<string, Set<string>>>(
        (acc, [entryId, peers]) => {
            const exits = peersExits.get(entryId);
            if (exits) {
                const filteredPeers = [...peers].filter((p) => exits.has(p));
                acc.set(entryId, new Set(filteredPeers));
            }
            return acc;
        },
        new Map(),
    );

    // determine online exits
    const exitEntries = revertMap(pairsMap);
    const onlineExitEntries = await filterOnline(exitEntries, entryNodes);
    const onlinePairsMap = revertMap(onlineExitEntries);

    const pairIds = toZeroHopPairings(onlinePairsMap);
    return q.writeZeroHopPairings(dbPool, pairIds).then(() => {
        log.info('updated zerohops with pairIds:', logZeroHopIds(pairIds));
        const all = new Map(
            entryNodes.map((eNode) => {
                const xIds = exitNodes.map(({ id }) => id);
                return [eNode.id, new Set(xIds)];
            }),
        );
        const diffPeers = diffStr(all, pairsMap);
        diffPeers.forEach((s) => log.info('missing peer matches: %s', s));
        const diffOnline = diffStr(pairsMap, onlinePairsMap);
        diffOnline.forEach((s) => log.info('missing online exit nodes: %s', s));
    });
}

async function runOneHops(
    dbPool: Pool,
    peersCache: PeersCache.PeersCache,
    entryNodes: q.RegisteredNode[],
    exitNodes: q.RegisteredNode[],
) {
    // gather channel structure
    const entryNode = randomEl(entryNodes);
    const respCh = await NodeAPI.getChannels({
        apiEndpoint: new URL(entryNode.hoprd_api_endpoint),
        accessToken: entryNode.hoprd_api_token,
    }).catch((err) => log.error('get channels: %s[%o]', JSON.stringify(err), err));
    if (!respCh) {
        return;
    }
    const channels = channelsMap(respCh.all);

    // match channels with peers
    const allEntryPeers = await peersMap(peersCache, entryNodes);
    const entryPeersChannels = filterChannels(allEntryPeers, channels);
    const nodeIds = new Set(entryNodes.map((e) => e.id).concat(exitNodes.map((x) => x.id)));
    const entryPeers = filterRelays(entryPeersChannels, nodeIds);

    // gather exit peers and determine exit nodes reachable by their peers
    const allExitPeers = await peersMap(peersCache, exitNodes);
    const exitPeers = filterRelays(allExitPeers, nodeIds);
    const peersExits = revertMap(exitPeers);

    // match exits reachable by channel peers
    const pairsRelaysMap = Array.from(entryPeers.entries()).reduce<
        Map<string, Map<string, Set<string>>>
    >((acc, [entryId, chPs]) => {
        [...chPs].forEach((p) => {
            const exits = peersExits.get(p);
            if (exits) {
                if (acc.has(entryId)) {
                    const exitRelays = acc.get(entryId) as Map<string, Set<string>>;
                    exits.forEach((x) => {
                        if (exitRelays.has(x)) {
                            const relays = exitRelays.get(x) as Set<string>;
                            relays.add(p);
                        } else {
                            exitRelays.set(x, new Set([p]));
                        }
                    });
                } else {
                    exits.forEach((x) => {
                        const exitRelays = new Map([[x, new Set([p])]]);
                        acc.set(entryId, exitRelays);
                    });
                }
            }
        });
        return acc;
    }, new Map());

    // clear table and insert gathered values
    const pairIds = toOneHopPairings(pairsRelaysMap);
    return q
        .writeOneHopPairings(dbPool, pairIds)
        .then(() =>
            log.info('updated onehops with pairIds:', logOneHopIds(pairsRelaysMap, pairIds.length)),
        );
}
/* eslint-enable @typescript-eslint/no-unused-vars */

async function peersMap(
    peersCache: PeersCache.PeersCache,
    nodes: q.RegisteredNode[],
): Promise<Map<string, Set<string>>> {
    const pRaw = nodes.map(async (node) => {
        const peers = await PeersCache.fetchPeers(peersCache, node).catch((err) =>
            log.error('fetch peers from %s: %s[%o]', node.id, JSON.stringify(err), err),
        );
        if (peers) {
            const ids = Array.from(peers.values()).map(({ peerId }) => peerId);
            return [node.id, new Set(ids)];
        }
        return null;
    });

    const raw = await Promise.allSettled(pRaw);
    const successes = raw.filter((val) => val.status === 'fulfilled' && !!val.value) as [
        { status: 'fulfilled'; value: [string, Set<string>] },
    ];
    return new Map(successes.map(({ value }) => value));
}

async function filterOnline(
    exitEntries: Map<string, Set<string>>,
    entryNodes: q.RegisteredNode[],
): Promise<Map<string, Set<string>>> {
    const messagePreps = Array.from(exitEntries.entries()).reduce((acc, [xId, entryIds]) => {
        const eId = randomEl(Array.from(entryIds.values()));
        const eNode = entryNodes.find((node) => node.id === eId) as q.RegisteredNode;
        if (acc.has(eId)) {
            acc.get(eId).exitIds.add(xId);
        } else {
            acc.set(eId, { eNode, exitIds: new Set([xId]) });
        }
        return acc;
    }, new Map()) as Map<string, { eNode: q.RegisteredNode; exitIds: Set<string> }>;

    const pPongs = Array.from(messagePreps.entries()).map(async ([eId, { eNode, exitIds }]) => {
        const conn = {
            apiEndpoint: new URL(eNode.hoprd_api_endpoint),
            accessToken: eNode.hoprd_api_token,
        };
        // delete any previous pongs
        await NodeAPI.deleteMessages(conn, ApplicationTag).catch((err) =>
            log.error(
                'delete messages from %s: %s[%o]',
                Utils.shortPeerId(eId),
                JSON.stringify(err),
                err,
            ),
        );

        // send pings
        const pPings = Array.from(exitIds.values()).map((xId, idx) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    NodeAPI.sendMessage(
                        { ...conn, hops: 0 },
                        { tag: ApplicationTag, recipient: xId, message: `ping-${eId}` },
                    )
                        .then(resolve)
                        .catch((err) => {
                            log.error(
                                'send ping from %s to %s: %s[%o]',
                                Utils.shortPeerId(eId),
                                Utils.shortPeerId(xId),
                                JSON.stringify(err),
                                err,
                            );
                            reject('Error sending ping');
                        });
                }, idx * 1);
            });
        });

        await Promise.all(pPings);

        // receive pongs (give 5 sec grace period)
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                NodeAPI.retrieveMessages(conn, ApplicationTag)
                    .then(resolve)
                    .catch((err) => {
                        log.error(
                            'retrieve messages from %s: %s[%o]',
                            JSON.stringify(Utils.shortPeerId(eId)),
                            JSON.stringify(err),
                            err,
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
        { status: 'fulfilled'; value: { messages: NodeAPI.Message[] } },
    ];
    const msgs = filteredRes.map(({ value }) => value.messages).flat();
    const onlineXids = msgs
        .map(({ body: pong }) => {
            if (pong.startsWith('pong-')) {
                const [, xId] = pong.split('-');
                return xId;
            }
        })
        .filter((x) => !!x);
    const online = new Set(onlineXids);

    return new Map(Array.from(exitEntries.entries()).filter(([xId, _entryIds]) => online.has(xId)));
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
    return Array.from(map.entries()).reduce((acc, [id, vals]) => {
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

function logZeroHopIds(pairs: q.ZeroHopPair[]): string {
    if (pairs.length === 0) {
        return '[(none)]';
    }
    const ids = pairs
        .map(({ entryId, exitId }) => `${Utils.shortPeerId(entryId)}>${Utils.shortPeerId(exitId)}`)
        .join(',');
    return `[${ids}]`;
}

function logOneHopIds(pairsRelayMap: Map<string, Map<string, Set<string>>>, total: number): string {
    const eCount = pairsRelayMap.size;
    if (eCount === 0) {
        return '[(none)]';
    }
    const entries = Array.from(pairsRelayMap).map(([eId, exitRelays]) => {
        const exits = Array.from(exitRelays).map(
            ([xId, relayIds]) => `${Utils.shortPeerId(xId)}[r:${relayIds.size}]`,
        );
        const xCount = exitRelays.size;
        return `${Utils.shortPeerId(eId)}[${xCount}x:${exits.join(',')}]`;
    });
    return `${total}routes ${eCount}e:${entries.join(' ')}`;
}

function filterChannels(
    peers: Map<string, Set<string>>,
    channels: Map<string, Set<string>>,
): Map<string, Set<string>> {
    return Array.from(peers.entries()).reduce((acc, [id, prs]) => {
        const chans = channels.get(id);
        if (chans) {
            const vals = [...prs].filter((x) => chans.has(x));
            acc.set(id, new Set(vals));
        }
        return acc;
    }, new Map());
}

function filterRelays(
    peers: Map<string, Set<string>>,
    relays: Set<string>,
): Map<string, Set<string>> {
    return Array.from(peers.entries()).reduce((acc, [id, prs]) => {
        const vals = [...prs].filter((x) => relays.has(x));
        acc.set(id, new Set(vals));
        return acc;
    }, new Map());
}

// expand to entryId -> exitId routes struct
function toZeroHopPairings(pairsMap: Map<string, Set<string>>): q.ZeroHopPair[] {
    return Array.from(pairsMap).reduce<q.ZeroHopPair[]>((acc, [entryId, exitIds]) => {
        exitIds.forEach((exitId) => {
            acc.push({ entryId, exitId });
        });
        return acc;
    }, []);
}

function toOneHopPairings(pairsRelayMap: Map<string, Map<string, Set<string>>>): q.OneHopPair[] {
    return Array.from(pairsRelayMap).reduce<q.OneHopPair[]>((outerAcc, [entryId, exitRelays]) => {
        return Array.from(exitRelays).reduce<q.OneHopPair[]>((innerAcc, [exitId, relayIds]) => {
            const entries = Array.from(relayIds).map((relayId) => ({ entryId, exitId, relayId }));
            return innerAcc.concat(entries);
        }, outerAcc);
    }, []);
}

function diffStr(target: Map<string, Set<string>>, current: Map<string, Set<string>>): string[] {
    const diff = Array.from(target.entries()).map<[string, Set<string>]>(([teId, txIds]) => {
        const xIds = current.get(teId);
        if (xIds) {
            const missing = [...txIds].filter((txId) => !xIds.has(txId));
            return [teId, new Set(missing)];
        }
        return [teId, txIds];
    }) as [string, Set<string>][];
    const missing = diff.filter(([, xIds]) => xIds.size > 0) as [string, Set<string>][];
    return missing.map(([eId, xIds]) => {
        const strXids = Array.from(xIds.values()).map(Utils.shortPeerId).join(',');
        return `${Utils.shortPeerId(eId)}>${strXids}`;
    });
}

function randomEl<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
