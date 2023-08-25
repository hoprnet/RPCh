import * as q from "./query";
import * as PeersCache from "./peers-cache";
import { createLogger, shortPeerId } from "./utils";

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
  const entryNodes = (await pEntryNodes).rows;
  const exitNodes = (await pExitNodes).rows;
  runZeroHops(dbPool, entryNodes, exitNodes).then(() => {
    // schedule new run every max 10 min
    const next = Math.floor(Math.random() * 10 * 60e3);
    const logN = Math.round(next / 1000);
    log.verbose("scheduling next run in", logN, "s");
    setTimeout(() => run(dbPool), next);
  });
  //runOneHops(entryNodes, exitNodes);
}

function runZeroHops(
  dbPool: Pool,
  entryNodes: RegisteredNode[],
  exitNodes: RegisteredNode[]
): Promise<void> {
  return new Promise((res) => {
    const peersCache: PeersCache.PeersCache = new Map();

    // run everything non blocking
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
    Promise.allSettled(allSettled)
      .then((res) => {
        const pairings = res.reduce<Pair[]>((outerAcc, outerPrm) => {
          if ("value" in outerPrm) {
            const outerPairs = outerPrm.value.reduce<Pair[]>(
              (innerAcc, innerPrm) => {
                if ("value" in innerPrm && !!innerPrm.value) {
                  innerAcc.push(innerPrm.value);
                }
                if ("reason" in innerPrm) {
                  log.info("Encountered rejection", innerPrm.reason);
                }
                return innerAcc;
              },
              []
            );
            return outerPairs;
          } else {
            if ("reason" in outerPrm) {
              log.info("Encountered rejection", outerPrm.reason);
            }
          }
          return outerAcc;
        }, []);

        const pairIds = pairings.map(({ entry, exit }) => ({
          entryId: entry.id,
          exitId: exit.id,
        }));

        const logIds = pairIds
          .map(
            ({ entryId, exitId }) =>
              `${shortPeerId(entryId)}>${shortPeerId(exitId)}`
          )
          .join(",");
        // now clear table and insert gathered values
        q.writeZeroHopPairings(dbPool, pairIds)
          .then(() => log.verbose("Updated db with pairIds", logIds))
          .catch((e: any) =>
            log.error("Error updating db", e, "with pairIds", logIds)
          );
      })
      .catch((err) => log.error("Error during zero hop check", err))
      .finally(res);
  });
}
