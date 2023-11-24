import { NodeAPI } from '@rpch/sdk';
import type { RegisteredNode } from './query';

export type PeersCache = Map<string, Map<string, NodeAPI.Peer>>; // node id -> peer id -> Peer

export function fetchPeers(
    cache: PeersCache,
    node: RegisteredNode,
): Promise<Map<string, NodeAPI.Peer>> {
    return new Promise((resolve, reject) => {
        if (cache.has(node.id)) {
            return resolve(cache.get(node.id)!);
        }
        NodeAPI.getPeers({
            apiEndpoint: new URL(node.hoprd_api_endpoint),
            accessToken: node.hoprd_api_token,
        })
            .then((res: NodeAPI.Peers | NodeAPI.NodeError) => {
                if (NodeAPI.isError(res)) {
                    return reject(res);
                }
                const peersMap = new Map(res.connected.map((p) => [p.peerId, p]));
                cache.set(node.id, peersMap);
                return resolve(peersMap);
            })
            .catch((err) => {
                return reject(err);
            });
    });
}
