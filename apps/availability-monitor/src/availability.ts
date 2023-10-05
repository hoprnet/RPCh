import * as q from "./query";
import * as PeersCache from "./peers-cache";
import { createLogger, shortPeerId } from "./utils";
import * as NodeAPI from "./node-api";

import type { Pool } from "pg";
import type { RegisteredNode } from "./query";
import type { Peer } from "./node-api";

const log = createLogger(["availability"]);

type PeersCache = Map<string, Map<string, Peer>>; // node id -> peer id -> Peer
type Pair = { entry: RegisteredNode; exit: RegisteredNode };

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

function runZeroHops(
  dbPool: Pool,
  peersCache: PeersCache.PeersCache,
  entryNodes: RegisteredNode[],
  exitNodes: RegisteredNode[]
) {
  const pPairs = entryNodes.map((entry) => {
    return PeersCache.fetchPeers(peersCache, entry).then((entryPeers) => {
      const viableExits = exitNodes.filter((x) => entryPeers.has(x.id));
      return viableExits.map((exit) =>
        PeersCache.fetchPeers(peersCache, exit).then((exitPeers) => {
          // check entry node is in quality peers of exit node
          if (exitPeers.has(entry.id)) {
            return { entry, exit };
          }
          return null;
        })
      );
    });
  });

  // collect results
  const allSettled = pPairs.map((p) =>
    p.then((pExits) => Promise.allSettled(pExits))
  );
  return Promise.allSettled(allSettled)
    .then((res) => {
      const pairings = res.reduce<Pair[]>((outerAcc, outerPrm) => {
        if ("value" in outerPrm) {
          const innerPairs = outerPrm.value.reduce<Pair[]>(
            (innerAcc, innerPrm) => {
              if ("value" in innerPrm && !!innerPrm.value) {
                innerAcc.push(innerPrm.value);
              }
              if ("reason" in innerPrm) {
                log.info(
                  "Encountered rejection",
                  JSON.stringify(innerPrm.reason)
                );
              }
              return innerAcc;
            },
            []
          );
          return outerAcc.concat(innerPairs);
        } else {
          if ("reason" in outerPrm) {
            log.info("Encountered rejection", JSON.stringify(outerPrm.reason));
          }
        }
        return outerAcc;
      }, []);

      const pairIds = pairings.map(({ entry, exit }) => ({
        entryId: entry.id,
        exitId: exit.id,
      }));

      // now clear table and insert gathered values
      q.writeZeroHopPairings(dbPool, pairIds)
        .then(() => log.verbose("Updated db with pairIds", logIds))
        .catch((e: any) =>
          log.error("Error updating db", e, "with pairIds", logIds)
        )
        .finally(() => reschedule(dbPool));
    })
    .catch((err) => {
      log.error("Error during zero hop check", err);
    });
}

async function runOneHops(
  dbPool: Pool,
  peersCache: PeersCache.PeersCache,
  entryNodes: RegisteredNode[],
  exitNodes: RegisteredNode[]
) {
  const entryNode = randomEl(entryNodes);
  const respCh = await NodeAPI.getChannels(entryNode).catch((err) =>
    log.error("Error getting channels", err)
  );
  if (!respCh) {
    return;
  }
  const channels = channelsMap(respCh.all);
  const entryPeers = await peersMap(peersCache, entryNodes);
  const peerChannels = filterChannels(entryPeers, channels);
  const exitPeers = await peersMap(peersCache, exitNodes);

  const peersExits = revertMap(exitPeers);

  const pairsMap = Array.from(peerChannels.entries()).reduce<
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

  const pairIds = Array.from(pairsMap).reduce<q.Pair[]>(
    (acc, [entryId, exitIds]) => {
      exitIds.forEach((exitId) => {
        acc.push({ entryId, exitId });
      });
      return acc;
    },
    []
  );

  const logStr = logIds(pairIds);
  // now clear table and insert gathered values
  q.writeOneHopPairings(dbPool, pairIds)
    .then(() => log.verbose("Updated db with pairIds", logStr))
    .catch((e) => log.error("Error updating db", e, "with pairIds", logStr));
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
    if (acc.has(destinationPeerId)) {
      acc.get(destinationPeerId).add(sourcePeerId);
    } else {
      acc.set(destinationPeerId, new Set([sourcePeerId]));
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
  return pairs
    .map(
      ({ entryId, exitId }) => `${shortPeerId(entryId)}>${shortPeerId(exitId)}`
    )
    .join(",");
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
