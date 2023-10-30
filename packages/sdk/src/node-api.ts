import WS from 'isomorphic-ws';

/**
 * to be replaced with HOPR sdk soon.
 */

export type ConnInfo = { apiEndpoint: URL; accessToken: string };

export type Message = { tag: number; body: string };

export type Heartbeats = {
    sent: number;
    success: number;
};

export type Peer = {
    peerId: string;
    multiAddr: string;
    heartbeats: Heartbeats[];
    lastSeen: number;
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

export type Channels = {
    all: Channel[];
    incoming: [];
    outgoing: [];
};

export function connectWS(conn: ConnInfo): WS.WebSocket {
    const wsURL = new URL('/api/v3/messages/websocket', conn.apiEndpoint);
    wsURL.protocol = conn.apiEndpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    wsURL.search = `?apiToken=${conn.accessToken}`;
    return new WS.WebSocket(wsURL);
}

export function sendMessage(
    conn: ConnInfo & { hops?: number },
    { recipient, tag, message }: { recipient: string; tag: number; message: string }
): Promise<string> {
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
        // default to one hop for now
        payload.hops = 1;
    }
    const body = JSON.stringify(payload);
    return fetch(url, { method: 'POST', headers, body }).then(
        (res) => res.json() as unknown as string
    );
}

export function version(conn: ConnInfo) {
    const url = new URL('/api/v3/node/version', conn.apiEndpoint);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    return fetch(url, { headers }).then((res) => res.json());
}

export function retrieveMessages(conn: ConnInfo, tag: number): Promise<{ messages: Message[] }> {
    const url = new URL('/api/v3/messages/pop-all', conn.apiEndpoint);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    const body = JSON.stringify({ tag });
    return fetch(url, { method: 'POST', headers, body }).then((res) => {
        return res.json() as unknown as { messages: Message[] };
    });
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
        return fetch(url, { method: 'DELETE', headers }).then((res) => {
            if (res.status === 204) {
                return resolve();
            }
            return reject(`Unexpected response status code: ${res.status}`);
        });
    });
}

export function accountAddresses(conn: ConnInfo) {
    const url = new URL('/api/v3/account/addresses', conn.apiEndpoint);
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    return fetch(url, { headers }).then((res) => {
        return res.json() as unknown as { native: string; hopr: string };
    });
}

export function getPeers(conn: ConnInfo): Promise<Peers> {
    const url = new URL('/api/v3/node/peers', conn.apiEndpoint);
    url.searchParams.set('quality', '1');
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    return fetch(url, { headers }).then((res) => res.json());
}

export function getChannels(conn: ConnInfo): Promise<Channels> {
    const url = new URL('/api/v3/channels', conn.apiEndpoint);
    url.searchParams.set('fullTopology', 'true');
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-auth-token': conn.accessToken,
    };
    return fetch(url, { headers }).then((res) => res.json());
}
