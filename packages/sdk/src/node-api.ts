import WebSocket = require('isomorphic-ws');

/**
 * to be replaced with HOPR sdk soon.
 */

export type ConnInfo = { apiEndpoint: URL; accessToken: string };

export type Message = { tag: number; body: string; receivedAt: number };

export type Heartbeats = {
    sent: number;
    success: number;
};

export type Peer = {
    peerId: string;
    peerAddress: string;
    multiAddr: string;
    heartbeats: Heartbeats[];
    lastSeen: number;
    lastSeenLatency: number;
    quality: number;
    backoff: number;
    isNew: boolean;
    reportedVersion: string;
};

export type Peers = {
    connected: Peer[];
    announced: Peer[];
};

export type Channel = {
    channelId: string;
    sourceAddress: string;
    destinationAddress: string;
    sourcePeerId: string;
    destinationPeerId: string;
    balance: string;
    status: string;
    ticketIndex: string;
    channelEpoch: string;
    closureTime: string;
};

export type PartChannel = {
    type: 'incoming' | 'outgoing';
    id: string;
    peerAddress: string;
    status: string;
    balance: string;
};

export type NodeError = {
    status: string;
    error: string;
};

export type AllChannels = {
    all: Channel[];
    incoming: [];
    outgoing: [];
};

export type NodeChannels = {
    all: [];
    incoming: PartChannel[];
    outgoing: PartChannel[];
};

export function connectWS(conn: ConnInfo): WebSocket {
    const wsURL = new URL('/api/v3/messages/websocket', conn.apiEndpoint);
    wsURL.protocol = conn.apiEndpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    wsURL.search = `?apiToken=${conn.accessToken}`;
    return new WebSocket(wsURL);
}

export function sendMessage(
    conn: ConnInfo & { hops?: number; relay?: string },
    { recipient, tag, message }: { recipient: string; tag: number; message: string }
): Promise<string | NodeError> {
    const url = new URL('/api/v3/messages', conn.apiEndpoint);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    const payload: Record<string, any> = {
        body: message,
        peerId: recipient,
        tag,
    };
    if (conn.hops === 0) {
        payload.path = [];
    } else {
        // default to one hop
        if (conn.relay) {
            payload.path = [conn.relay];
        } else {
            payload.hops = 1;
        }
    }
    const body = JSON.stringify(payload);
    return fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(30000) }).then(
        (res) => res.json()
    );
}

export function version(conn: ConnInfo) {
    const url = new URL('/api/v3/node/version', conn.apiEndpoint);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    return fetch(url, { headers, signal: AbortSignal.timeout(30000) }).then((res) => res.json());
}

export function retrieveMessages(conn: ConnInfo, tag: number): Promise<{ messages: Message[] }> {
    const url = new URL('/api/v3/messages/pop-all', conn.apiEndpoint);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    const body = JSON.stringify({ tag });
    return fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(30000) }).then(
        (res) => {
            return res.json() as unknown as { messages: Message[] };
        }
    );
}

export function deleteMessages(conn: ConnInfo, tag: number): Promise<void> {
    const url = new URL('/api/v3/messages', conn.apiEndpoint);
    url.searchParams.set('tag', `${tag}`);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    return new Promise((resolve, reject) => {
        return fetch(url, { method: 'DELETE', headers, signal: AbortSignal.timeout(30000) }).then(
            (res) => {
                if (res.status === 204) {
                    return resolve();
                }
                return reject(`Unexpected response status code: ${res.status}`);
            }
        );
    });
}

export function accountAddresses(conn: ConnInfo) {
    const url = new URL('/api/v3/account/addresses', conn.apiEndpoint);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    return fetch(url, { headers, signal: AbortSignal.timeout(30000) }).then((res) => {
        return res.json() as unknown as { native: string; hopr: string };
    });
}

export function getPeers(conn: ConnInfo): Promise<Peers | NodeError> {
    const url = new URL('/api/v3/node/peers', conn.apiEndpoint);
    url.searchParams.set('quality', '1');
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    return fetch(url, { headers, signal: AbortSignal.timeout(30000) }).then((res) => res.json());
}

export function getAllChannels(conn: ConnInfo): Promise<AllChannels> {
    const url = new URL('/api/v3/channels', conn.apiEndpoint);
    url.searchParams.set('fullTopology', 'true');
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    return fetch(url, { headers, signal: AbortSignal.timeout(30000) }).then((res) => res.json());
}

export function getNodeChannels(conn: ConnInfo): Promise<NodeChannels> {
    const url = new URL('/api/v3/channels', conn.apiEndpoint);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    return fetch(url, { headers, signal: AbortSignal.timeout(30000) }).then((res) => res.json());
}

export function isError(payload: NonNullable<unknown> | NodeError): payload is NodeError {
    return 'error' in payload;
}
