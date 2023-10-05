import * as q from "./query";
import * as PeersCache from "./peers-cache";
import { createLogger, shortPeerId } from "./utils";
import * as NodeAPI from "./node-api";

import type { Pool } from "pg";
import type { RegisteredNode } from "./query";
import type { Peer } from "./node-api";

const log = createLogger(["availability"]);

type PeersCache = Map<string, Map<string, Peer>>; // node id -> peer id -> Peer

export async function start(dbPool: Pool) {
  dbPool.on("error", (err, client) =>
    log.error("pg pool error", err, "on client", client)
  );
  dbPool.connect();

  run(dbPool);
}

async function run(dbPool: Pool) {
  const pEntryNodes = q.entryNodes(dbPool);
  const pExitNodes = q.exitNodes(dbPool);
  Promise.all([pEntryNodes, pExitNodes])
    .then(async ([qEntries, qExits]) => {
      const peersCache: PeersCache.PeersCache = new Map();
      await runZeroHops(dbPool, peersCache, qEntries.rows, qExits.rows);
      await runOneHops(dbPool, peersCache, qEntries.rows, qExits.rows);
    })
    .catch((ex) => {
      log.error("Error during determining routes", ex);
    })
    .finally(() => reschedule(dbPool));
}

function reschedule(dbPool: Pool) {
  // schedule new run every max 10 min
  const next = Math.floor(Math.random() * 10 * 60e3);
  const logN = Math.round(next / 1000);
  log.verbose("scheduling next run in", logN, "s");
  setTimeout(() => run(dbPool), next);
}

async function runZeroHops(
  dbPool: Pool,
  peersCache: PeersCache.PeersCache,
  entryNodes: RegisteredNode[],
  exitNodes: RegisteredNode[]
) {
  const entryPeers = await peersMap(peersCache, entryNodes);

  // gather exit peers and determine exit nodes reachable by their peers
  const exitPeers = await peersMap(peersCache, exitNodes);
  const peersExits = revertMap(exitPeers);

  // match routes
  const pairsMap = Array.from(entryPeers.entries()).reduce<
    Map<string, Set<string>>
  >((acc, [entryId, peers]) => {
    const exits = peersExits.get(entryId);
    if (exits) {
      const filteredPeers = [...peers].filter((p) => exits.has(p));
      acc.set(entryId, new Set(filteredPeers));
    }
    return acc;
  }, new Map());

  const pairIds = toPairings(pairsMap);
  return q
    .writeZeroHopPairings(dbPool, pairIds)
    .then(() => log.verbose("Updated zerohops with pairIds", logIds(pairIds)));
}

async function runOneHops(
  dbPool: Pool,
  peersCache: PeersCache.PeersCache,
  entryNodes: RegisteredNode[],
  exitNodes: RegisteredNode[]
) {
  // gather channel structure
  const entryNode = randomEl(entryNodes);
  const respCh = await NodeAPI.getChannels(entryNode).catch((err) =>
    log.error("Error getting channels", err)
  );
  if (!respCh) {
    return;
  }
  const channels = channelsMap(respCh.all);

  // match channels with peers
  const entryPeers = await peersMap(peersCache, entryNodes);
  const entryPeersChannels = filterChannels(entryPeers, channels);

  // gather exit peers and determine exit nodes reachable by their peers
  const exitPeers = await peersMap(peersCache, exitNodes);
  const peersExits = revertMap(exitPeers);

  // match exits reachable by channel peers
  const pairsMap = Array.from(entryPeersChannels.entries()).reduce<
    Map<string, Set<string>>
  >((acc, [entryId, chPs]) => {
    [...chPs].forEach((p) => {
      const exits = peersExits.get(p);
      if (exits) {
        if (acc.has(entryId)) {
          const vals = acc.get(entryId)!;
          acc.set(entryId, new Set([...vals, ...exits]));
        } else {
          acc.set(entryId, exits);
        }
      }
    });
    return acc;
  }, new Map());

  // clear table and insert gathered values
  const pairIds = toPairings(pairsMap);
  return q
    .writeOneHopPairings(dbPool, pairIds)
    .then(() => log.verbose("Updated onehops with pairIds", logIds(pairIds)));
}

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function peersMap(
  peersCache: PeersCache.PeersCache,
  nodes: q.RegisteredNode[]
): Promise<Map<string, Set<string>>> {
  const pRaw = nodes.map(async (node) => {
    const peers = await PeersCache.fetchPeers(peersCache, node).catch((err) =>
      log.error("Error fetching peers", err, "for node", node.id)
    );
    if (peers) {
      const ids = Array.from(peers.values()).map(({ peerId }) => peerId);
      return [node.id, new Set(ids)];
    }
    return null;
  });

  const raw = await Promise.all(pRaw);
  const rawValues = raw.filter((val) => !!val) as [string, Set<string>][];
  return new Map(rawValues);
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

function logIds(pairs: q.Pair[]): string {
  if (pairs.length === 0) {
    return "[none]";
  }
  const ids = pairs
    .map(
      ({ entryId, exitId }) => `${shortPeerId(entryId)}>${shortPeerId(exitId)}`
    )
    .join(",");
  return `[${ids}]`;
}

function filterChannels(
  peers: Map<string, Set<string>>,
  channels: Map<string, Set<string>>
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

// expand to entryId -> exitId routes struct
function toPairings(pairsMap: Map<string, Set<string>>): q.Pair[] {
  return Array.from(pairsMap).reduce<q.Pair[]>((acc, [entryId, exitIds]) => {
    exitIds.forEach((exitId) => {
      acc.push({ entryId, exitId });
    });
    return acc;
  }, []);
}
