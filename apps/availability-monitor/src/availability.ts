import type { Client } from "pg";

import * as api from "./node-api";
import * as q from "./query";
import { createLogger } from "./utils";

const log = createLogger(["availability"]);

export async function run(client: Client) {
  client.on("error", (err) => log.error("pg client error", err));
  const pEntryNodes = q.entryNodes(client);
  const pExitNodes = q.exitNodes(client);
  const entryNodes = await pEntryNodes;
  const exitNodes = await pExitNodes;
  console.log("entryNodes", entryNodes);
  console.log("exitNodes", exitNodes);
  runZeroHopChecks(entryNodes, exitNodes);
  runOneHopChecks(entryNodes, exitNodes);
}

function runZeroHopChecks(entryNodes: any, exitNodes: any) {
  // const now = Date.now();
  entryNodes.forEach(async (e: { apiEndpoint: URL; accessToken: string }) => {
    const peers = await api.getPeers(e);
    exitNodes.forEach((x: { id: string }) => {
      const p = peers.connected.find((p: { id: string }) => p.id === x.id);
      console.log("p", p);
    });
  });
}

function runOneHopChecks(_entryNodes: any, _exitNodes: any) {}
