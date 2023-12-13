import type { EntryNode } from './entry-node';
import type { ExitNode } from './exit-node';

export const NoMoreNodes = 'no more nodes';
export const Unauthorized = 'unauthorized';

/**
 * This module contains all communication with the discovery platform.
 * All calls are behind exponential backoff to avoid DOSing the DP on errors.
 */

export type ClientOps = {
    discoveryPlatformEndpoint: string;
    clientId: string;
    forceZeroHop: boolean;
};

export type NodeOps = {
    discoveryPlatformEndpoint: string;
    nodeAccessToken: string;
};

export type Versions = {
    sdk: string;
    rpcServer: string;
};

export type Nodes = {
    entryNodes: EntryNode[];
    exitNodes: ExitNode[];
    matchedAt: string;
    versions: Versions;
};

export type QuotaParams = {
    clientId: string;
    rpcMethod?: string;
    segmentCount: number;
    lastSegmentLength?: number;
    type: 'request' | 'response';
};

export function fetchNodes(ops: ClientOps, amount: number, since: Date): Promise<Nodes> {
    const url = new URL('/api/v1/nodes/pairings', ops.discoveryPlatformEndpoint);
    url.searchParams.set('amount', `${amount}`);
    url.searchParams.set('since', since.toISOString());
    url.searchParams.set('force_zero_hop', `${ops.forceZeroHop}`);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-rpch-client': ops.clientId,
    };

    return fetch(url, { headers }).then((res) => {
        switch (res.status) {
            case 204: // none found
                throw new Error(NoMoreNodes);
            case 403: // unauthorized
                throw new Error(Unauthorized);
            default:
                return res.json();
        }
    });
}

export function fetchQuota(
    ops: NodeOps,
    { clientId, segmentCount, rpcMethod, type, lastSegmentLength }: QuotaParams,
): Promise<void> {
    const url = new URL(`/api/v1/quota/${type}`, ops.discoveryPlatformEndpoint);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-rpch-node': ops.nodeAccessToken,
    };
    const body = JSON.stringify({
        clientId,
        segmentCount,
        rpcMethod,
        lastSegmentLength,
    });
    return new Promise((pRes, pRej) => {
        fetch(url, { headers, method: 'POST', body })
            .then((res) => {
                if (res.status === 204) {
                    return pRes();
                }
                return pRej(`Unexpected response code: ${res.status}`);
            })
            .catch((err) => pRej(err));
    });
}
