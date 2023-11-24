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
            await doRun(dbPool, entries, exits);
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

async function doRun(dbPool: Pool, entries: q.RegisteredNode[], exits: q.RegisteredNode[]) {
    const peersCache: PeersCache.PeersCache = new Map();
    const zhPairs = await runZeroHops(dbPool, peersCache, entries, exits).catch((err) => {
        log.error('error determining zero hop routes: %s[%o]', JSON.stringify(err), err);
        throw err;
    });
    const ohRelPairs = await runOneHops(dbPool, peersCache, entries, exits).catch((err) => {
        log.error('error determining one hop routes: %s[%o]', JSON.stringify(err), err);
        throw err;
    });
    // gather all exits and check if they are online
    const zhExitIds = Array.from(zhPairs.values())
        .map((xIds) => Array.from(xIds))
        .flat() as string[];
    const ohExitIds = Array.from(ohRelPairs.values())
        .map((m) => Array.from(m.keys()))
        .flat() as string[];
    const allExitIds = new Set(zhExitIds.concat(ohExitIds));
    const eIds: [string, q.RegisteredNode][] = entries.map((n) => [n.id, n]);
    const xIds: [string, q.RegisteredNode][] = exits.map((n) => [n.id, n]);
    const nodes = new Map(eIds.concat(xIds));
    const onlineExitIds = await filterOnline(allExitIds, peersCache, nodes);
    const offlineExits = Array.from(allExitIds).filter((id) => !onlineExitIds.has(id));

    const zhOnline = filterZhOnline(zhPairs, onlineExitIds);
    const ohOnline = filterOhOnline(ohRelPairs, onlineExitIds);

    // write zero hops
    const zhMax = entries.length * exits.length;
    const zhPairIds = toZeroHopPairings(zhOnline);
    await q.writeZeroHopPairings(dbPool, zhPairIds);
    log.info('updated zerohops with pairIds:', logZeroHopIds(zhOnline, zhPairIds.length, zhMax));

    // write one hops
    const ohMax = entries.length * exits.length * (entries.length + exits.length - 2);
    const ohPairIds = toOneHopPairings(ohOnline);
    await q.writeOneHopPairings(dbPool, ohPairIds);
    log.info('updated onehops with pairIds:', logOneHopIds(ohOnline, ohPairIds.length, ohMax));

    // complain about offline peers
    const offIds = Array.from(offlineExits).map((xId) => Utils.shortPeerId(xId));
    log.warn(`missing ${offIds.length}/${allExitIds.size} online exit ids: ${offIds.join(' ')}`);
}

async function runZeroHops(
    dbPool: Pool,
    peersCache: PeersCache.PeersCache,
    entryNodes: q.RegisteredNode[],
    exitNodes: q.RegisteredNode[],
): Promise<Map<string, Set<string>>> {
    const entryPeers = await peersMap(peersCache, entryNodes);

    // gather exit peers and determine exit nodes reachable by their peers
    const exitPeers = await peersMap(peersCache, exitNodes);
    const peersExits = revertMap(exitPeers);

    // match routes
    return Array.from(entryPeers.entries()).reduce<Map<string, Set<string>>>(
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
}

async function runOneHops(
    dbPool: Pool,
    peersCache: PeersCache.PeersCache,
    entryNodes: q.RegisteredNode[],
    exitNodes: q.RegisteredNode[],
): Promise<Map<string, Map<string, Set<string>>>> {
    // gather channel structure
    const entryNode = randomEl(entryNodes);
    const respCh = await NodeAPI.getChannels({
        apiEndpoint: new URL(entryNode.hoprd_api_endpoint),
        accessToken: entryNode.hoprd_api_token,
    }).catch((err) => {
        log.error('get channels: %s[%o]', JSON.stringify(err), err);
        throw err;
    });
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
    return Array.from(entryPeers.entries()).reduce<Map<string, Map<string, Set<string>>>>(
        (acc, [entryId, chPs]) => {
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
        },
        new Map(),
    );
}

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
    exitIds: Set<string>,
    peersCache: PeersCache.PeersCache,
    nodes: Map<string, q.RegisteredNode>,
): Promise<Set<string>> {
    const messagePreps: Map<string, { eNode: q.RegisteredNode; exitIds: Set<string> }> =
        await Array.from(exitIds).reduce((acc, xId) => {
            const allPeers = peersCache.get(xId) as Map<string, NodeAPI.Peer>;
            const peers = Array.from(allPeers.values()).filter((p) => nodes.has(p.peerId));
            if (peers.length > 0) {
                const p = randomEl(peers);
                const eNode = nodes.get(p.peerId) as q.RegisteredNode;
                if (acc.has(p.peerId)) {
                    acc.get(p.peerId).exitIds.add(xId);
                } else {
                    acc.set(p.peerId, { eNode, exitIds: new Set([xId]) });
                }
            }
            return acc;
        }, new Map());

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
            const delay = idx * 1;
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

function logZeroHopIds(pairs: Map<string, Set<string>>, total: number, max: number): string {
    const eCount = pairs.size;
    if (eCount === 0) {
        return '[(none)]';
    }
    const entries = Array.from(pairs).map(([eId, exitIds]) => {
        const exits = Array.from(exitIds).map((x) => `x${Utils.shortPeerId(x)}`);
        const xCount = exitIds.size;
        return `e${Utils.shortPeerId(eId)}>${xCount}x:${exits.join('_')}`;
    });
    return `${total}/${max} routes over ${eCount} entries ${entries.join(',')}`;
}

function logOneHopIds(
    pairsRelayMap: Map<string, Map<string, Set<string>>>,
    total: number,
    max: number,
): string {
    const eCount = pairsRelayMap.size;
    if (eCount === 0) {
        return '[(none)]';
    }
    const entries = Array.from(pairsRelayMap).map(([eId, exitRelays]) => {
        const exits = Array.from(exitRelays).map(
            ([xId, relayIds]) => `x${Utils.shortPeerId(xId)}[${relayIds.size}r]`,
        );
        const xCount = exitRelays.size;
        return `e${Utils.shortPeerId(eId)}[${xCount}x]>${exits.join('_')}`;
    });
    return `${total}/${max} routes over ${eCount} entries ${entries.join(',')}`;
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

function filterZhOnline(
    pairs: Map<string, Set<string>>,
    online: Set<string>,
): Map<string, Set<string>> {
    return Array.from(pairs).reduce((acc, [eId, xIds]) => {
        const vals = new Set(Array.from(xIds).filter((x) => online.has(x)));
        if (vals.size > 0) {
            acc.set(eId, vals);
        }
        return acc;
    }, new Map());
}

function filterOhOnline(
    pairs: Map<string, Map<string, Set<string>>>,
    online: Set<string>,
): Map<string, Map<string, Set<string>>> {
    return Array.from(pairs).reduce((acc, [eId, relayIds]) => {
        const vals = Array.from(relayIds).filter(([x, _rIds]) => online.has(x));
        if (vals.length > 0) {
            acc.set(eId, new Map(vals));
        }
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

function randomEl<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
