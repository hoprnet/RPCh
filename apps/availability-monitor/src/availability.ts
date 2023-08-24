import type { Client } from "pg";
import type { RegisteredNode } from "./query";

import * as api from "./node-api";
import * as q from "./query";
import { createLogger } from "./utils";

const log = createLogger(["availability"]);

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

function runZeroHopChecks(entryNodes: any, exitNodes: any) {
  // const now = Date.now();
  entryNodes.forEach(async (e: RegisteredNode) => {
    const entryPeers = await api.getPeers(e);
    const entryPeersMap = new Map(
      entryPeers.connected.map((p) => [p.peerId, p])
    );
    exitNodes.forEach(async (x: RegisteredNode) => {
      const entryPeer = entryPeersMap.get(x.id);
      if (entryPeer) {
        // exit node is listed as quality peer of entry node
        const exitPeers = await api.getPeers(x);
        const exitPeersMap = new Map(
          exitPeers.connected.map((p) => [p.peerId, p])
        );
        const exitPeer = exitPeersMap.get(e.id);
        if (exitPeer) {
          // entry node is listed as quality peer exit node
          console.log("quality peering", e, x, entryPeer, exitPeer);
        }
      }
    });
  });
}

function runOneHopChecks(_entryNodes: any, _exitNodes: any) {}
