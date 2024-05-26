/**
 * This module contains all communication with the discovery platform.
 */

export type Conn = {
    discoveryPlatformEndpoint: string;
    clientId: string;
};

export type Versions = {
    sdk: string;
    rpcServer: string;
};

export async function fetchVersions(conn: Conn): Promise<Versions> {
    const url = new URL('/api/v1/configs', conn.discoveryPlatformEndpoint);
    url.searchParams.set('key', 'RPCh_SDK_VERSION');
    url.searchParams.append('key', 'RPCh_RPC_SERVER_VERSION');
    const headers = {
        'Accept': 'application/json',
        'x-rpch-client': conn.clientId,
    };
    const res = await fetch(url, { headers });
    if (res.ok) {
        const { RPCh_RPC_SERVER_VERSION: rpcServer, RPCh_SDK_VERSION: sdk } =
            (await res.json()) as { RPCh_RPC_SERVER_VERSION: string; RPCh_SDK_VERSION: string };
        return { sdk, rpcServer };
    }
    const reason = await res.text();
    throw new Error(`Error fetching configs [${res.status}]: ${reason}`);
}
