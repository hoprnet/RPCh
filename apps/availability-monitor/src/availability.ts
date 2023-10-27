import { NodeAPI } from "@rpch/sdk";
import * as q from "./query";
import * as PeersCache from "./peers-cache";
import { createLogger, shortPeerId } from "./utils";

import type { Pool } from "pg";

const log = createLogger(["availability"]);
const ApplicationTag = 0xffff;

type PeersCache = Map<string, Map<string, NodeAPI.Peer>>; // node id -> peer id -> Peer

export async function start(dbPool: Pool) {
  dbPool.on("error", (err, client) =>
    log.error("pg pool error on client %s: %s", client, JSON.stringify(err))
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
    .catch((err) => {
      log.error("Error during determining routes", JSON.stringify(err));
    })
    .finally(() => reschedule(dbPool));
}

function reschedule(dbPool: Pool) {
  // schedule new run every min 30sec and max 10 min
  const next = 30e3 + Math.floor(Math.random() * 9.5 * 60e3);
  const logN = Math.round(next / 1000);
  log.verbose("scheduling next run in", logN, "s");
  setTimeout(() => run(dbPool), next);
}

async function runZeroHops(
  dbPool: Pool,
  peersCache: PeersCache.PeersCache,
  entryNodes: q.RegisteredNode[],
  exitNodes: q.RegisteredNode[]
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

  // determine online exits
  const exitEntries = revertMap(pairsMap);
  const onlineExitEntries = await filterOnline(exitEntries, entryNodes);
  const onlinePairsMap = revertMap(onlineExitEntries);

  const pairIds = toPairings(onlinePairsMap);
  return q.writeZeroHopPairings(dbPool, pairIds).then(() => {
    log.verbose("Updated zerohops with pairIds", logIds(pairIds));
    const all = new Map(
      entryNodes.map((eNode) => {
        const xIds = exitNodes.map(({ id }) => id);
        return [eNode.id, new Set(xIds)];
      })
    );
    const diffPeers = diffStr(all, pairsMap);
    diffPeers.forEach((s) => log.verbose("Missing peer matches: %s", s));
    const diffOnline = diffStr(pairsMap, onlinePairsMap);
    diffOnline.forEach((s) => log.verbose("Missing online exit nodes: %s", s));
  });
}

async function runOneHops(
  dbPool: Pool,
  peersCache: PeersCache.PeersCache,
  entryNodes: q.RegisteredNode[],
  exitNodes: q.RegisteredNode[]
) {
  // gather channel structure
  const entryNode = randomEl(entryNodes);
  const respCh = await NodeAPI.getChannels({
    apiEndpoint: new URL(entryNode.hoprd_api_endpoint),
    accessToken: entryNode.hoprd_api_token,
  }).catch((err) => log.error("Error getting channels", JSON.stringify(err)));
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

async function peersMap(
  peersCache: PeersCache.PeersCache,
  nodes: q.RegisteredNode[]
): Promise<Map<string, Set<string>>> {
  const pRaw = nodes.map(async (node) => {
    const peers = await PeersCache.fetchPeers(peersCache, node).catch((err) =>
      log.error("Error fetching peers for %s: %s", node.id, JSON.stringify(err))
    );
    if (peers) {
      const ids = Array.from(peers.values()).map(({ peerId }) => peerId);
      return [node.id, new Set(ids)];
    }
    return null;
  });

  const raw = await Promise.allSettled(pRaw);
  const successes = raw.filter(
    (val) => val.status === "fulfilled" && !!val.value
  ) as [{ status: "fulfilled"; value: [string, Set<string>] }];
  return new Map(successes.map(({ value }) => value));
}

async function filterOnline(
  exitEntries: Map<string, Set<string>>,
  entryNodes: q.RegisteredNode[]
): Promise<Map<string, Set<string>>> {
  const messagePreps = Array.from(exitEntries.entries()).reduce(
    (acc, [xId, entryIds]) => {
      const eId = randomEl(Array.from(entryIds.values()));
      const eNode = entryNodes.find(
        (node) => node.id === eId
      ) as q.RegisteredNode;
      if (acc.has(eId)) {
        acc.get(eId).exitIds.add(xId);
      } else {
        acc.set(eId, { eNode, exitIds: new Set([xId]) });
      }
      return acc;
    },
    new Map()
  ) as Map<string, { eNode: q.RegisteredNode; exitIds: Set<string> }>;

  const pPongs = Array.from(messagePreps.entries()).map(
    async ([eId, { eNode, exitIds }]) => {
      const conn = {
        apiEndpoint: new URL(eNode.hoprd_api_endpoint),
        accessToken: eNode.hoprd_api_token,
      };
      // delete any previous pongs
      await NodeAPI.deleteMessages(conn, ApplicationTag).catch((err) =>
        log.error(
          "Error deleting messages from %s: %s",
          shortPeerId(eId),
          JSON.stringify(err)
        )
      );

      // send pings
      const pPings = Array.from(exitIds.values()).map((xId, idx) => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            NodeAPI.sendMessage(
              { ...conn, hops: 0 },
              { tag: ApplicationTag, recipient: xId, message: `ping-${eId}` }
            )
              .then(resolve)
              .catch((err) => {
                log.error(
                  "Error sending ping from %s to %s: %s",
                  shortPeerId(eId),
                  shortPeerId(xId),
                  JSON.stringify(err)
                );
                reject("Error sending ping");
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
                "Error retrieving messages from %s: %s",
                JSON.stringify(shortPeerId(eId)),
                JSON.stringify(err)
              );
              reject("Error retrieving messages");
            });
        }, 5e3);
      });
    }
  );

  const results = (await Promise.allSettled(pPongs)) as PromiseSettledResult<{
    messages: NodeAPI.Message[];
  }>[];
  const filteredRes = results.filter((pRes) => pRes.status === "fulfilled") as [
    { status: "fulfilled"; value: { messages: NodeAPI.Message[] } }
  ];
  const msgs = filteredRes.map(({ value }) => value.messages).flat();
  const onlineXids = msgs
    .map(({ body: pong }) => {
      if (pong.startsWith("pong-")) {
        const [, xId] = pong.split("-");
        return xId;
      }
    })
    .filter((x) => !!x);
  const online = new Set(onlineXids);

  return new Map(
    Array.from(exitEntries.entries()).filter(([xId, _entryIds]) =>
      online.has(xId)
    )
  );
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
    return "[(none)]";
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

function diffStr(
  target: Map<string, Set<string>>,
  current: Map<string, Set<string>>
): string[] {
  const diff = Array.from(target.entries()).map<[string, Set<string>]>(
    ([teId, txIds]) => {
      const xIds = current.get(teId);
      if (xIds) {
        const missing = [...txIds].filter((txId) => !xIds.has(txId));
        return [teId, new Set(missing)];
      }
      return [teId, txIds];
    }
  ) as [string, Set<string>][];
  const missing = diff.filter(([, xIds]) => xIds.size > 0) as [
    string,
    Set<string>
  ][];
  return missing.map(([eId, xIds]) => {
    const strXids = Array.from(xIds.values()).map(shortPeerId).join(",");
    return `${shortPeerId(eId)}>${strXids}`;
  });
}

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
