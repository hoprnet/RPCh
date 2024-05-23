import * as pg from 'pg';

export enum Keys {
    RPCh_DOCKER_COMMAND_PARAMS = 'RPCh_DOCKER_COMMAND_PARAMS',
    RPCh_DOCKER_IMAGE = 'RPCh_DOCKER_IMAGE',
    RPCh_DOCKER_IMAGE_VERSION = 'RPCh_DOCKER_IMAGE_VERSION',
    RPCh_PROVIDER_ETHEREUM = 'RPCh_PROVIDER_ETHEREUM',
    RPCh_PROVIDER_GNOSIS = 'RPCh_PROVIDER_GNOSIS',
    RPCh_PROVIDER_POLYGON_ZKEVM = 'RPCh_PROVIDER_POLYGON_ZKEVM',
    RPCh_RPC_SERVER_VERSION = 'RPCh_RPC_SERVER_VERSION',
    RPCh_SDK_VERSION = 'RPCh_SDK_VERSION',
    RPCh_URL_BASE = 'RPCh_URL_BASE',
}

export async function listCongigs(
    dbPool: pg.Pool,
    keys: Keys[]
): Promise<{ key: string; data: string }[]> {
    const q = 'select key, data from configs where key in $1';
    const { rows } = await dbPool.query(q, [keys]);
    return rows;
}

export async function readConfig(dbPool: pg.Pool, key: Keys): Promise<string | undefined> {
    const q = 'select data from configs where key = $1';
    const { rows } = await dbPool.query(q, [key]);
    return rows[0]?.data;
}
