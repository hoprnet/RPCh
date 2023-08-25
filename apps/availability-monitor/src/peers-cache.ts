import type { Peer } from "./node-api";
import type { RegisteredNode } from "./query";

import * as api from "./node-api";

export type PeersCache = Map<string, Map<string, Peer>>; // node id -> peer id -> Peer

export function fetchPeers(
  cache: PeersCache,
  node: RegisteredNode
): Promise<Map<string, Peer>> {
  return new Promise((resolve, reject) => {
    if (cache.has(node.id)) {
      return resolve(cache.get(node.id)!);
    }
    api
      .getPeers(node)
      .then((peers) => {
        const peersMap = new Map(peers.connected.map((p) => [p.peerId, p]));
        cache.set(node.id, peersMap);
        resolve(peersMap);
      })
      .catch((err) => {
        reject(err);
      });
  });
}
