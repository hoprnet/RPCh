import * as q from "./query";
import * as PeersCache from "./peers-cache";
import { createLogger } from "./utils";

import type { Client } from "pg";
import type { RegisteredNode } from "./query";
import type { Peer } from "./node-api";

const log = createLogger(["availability"]);

type PeersCache = Map<string, Map<string, Peer>>; // node id -> peer id -> Peer

export async function run(client: Client) {
  client.on("error", (err) => log.error("pg client error", err));
  client.connect();
  const pEntryNodes = q.entryNodes(client);
  const pExitNodes = q.exitNodes(client);
  const entryNodes = (await pEntryNodes).rows;
  const exitNodes = (await pExitNodes).rows;
  runZeroHopChecks(entryNodes, exitNodes);
  runOneHopChecks(entryNodes, exitNodes);
}

function runZeroHopChecks(
  entryNodes: RegisteredNode[],
  exitNodes: RegisteredNode[]
) {
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
      const pairings = res.reduce<
        { entry: RegisteredNode; exit: RegisteredNode }[]
      >((outerAcc, outerPrm) => {
        if ("value" in outerPrm) {
          const outerPairs = outerPrm.value.reduce<
            { entry: RegisteredNode; exit: RegisteredNode }[]
          >((innerAcc, innerPrm) => {
            if (innerPrm && "value" in innerPrm && !!innerPrm.value) {
              innerAcc.push(innerPrm.value);
            }
            return innerAcc;
          }, []);
          return outerPairs;
        }
        return outerAcc;
      }, []);
      console.log("pairings", pairings);
    })
    .catch((err) => log.error("Error during zero hop check", err));
}

function runOneHopChecks(_entryNodes: any, _exitNodes: any) {}
