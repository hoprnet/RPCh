import { NodeAPI } from '@rpch/sdk';
import type { RegisteredNode } from './query';

export enum NodeStatus {
    Offline,
    Online,
}

export type NodeOffline = { status: NodeStatus.Offline };
export type NodeOnlinePeers = { status: NodeStatus.Online; peers: Map<string, NodeAPI.Peer> };

export type NodePeers = NodeOnlinePeers | NodeOffline;

export type PeersCache = Map<string, NodePeers>;

export function init(): PeersCache {
    return new Map();
}

export async function fetchPeers(cache: PeersCache, node: RegisteredNode): Promise<NodePeers> {
    // cache hit
    if (cache.has(node.id)) {
        return cache.get(node.id)!;
    }

    // query peers
    const res: NodeAPI.Peers | NodeAPI.NodeError = await NodeAPI.getPeers({
        apiEndpoint: new URL(node.hoprd_api_endpoint),
        accessToken: node.hoprd_api_token,
    }).catch((err) => {
        cache.set(node.id, { status: NodeStatus.Offline });
        throw err;
    });

    if (!res) {
        cache.set(node.id, { status: NodeStatus.Offline });
        throw new Error('no results');
    }

    if (NodeAPI.isError(res)) {
        cache.set(node.id, { status: NodeStatus.Offline });
        throw new Error(`${res.status}: ${res.error}`);
    }

    const peers = new Map(res.connected.map((p) => [p.peerId, p]));
    const entry = { status: NodeStatus.Online, peers };
    cache.set(node.id, entry);
    return entry;
}

export function isOnline(np: void | NodePeers): np is NodeOnlinePeers {
    return !!np && np.status === NodeStatus.Online;
}
