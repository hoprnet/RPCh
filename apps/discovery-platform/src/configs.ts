import * as pg from 'pg';

export enum Key {
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

export async function list(
    dbPool: pg.Pool,
    key: Key | Key[]
): Promise<{ key: string; data: string }[]> {
    const keys = toKeys(key);
    const strKeys = Array.from(keys).join("','");
    const q = `select key, data from configs where key in ('${strKeys}')`;
    const { rows } = await dbPool.query(q);
    return rows;
}

export async function read(dbPool: pg.Pool, key: Key): Promise<string> {
    const q = 'select data from configs where key = $1';
    const { rows } = await dbPool.query(q, [key]);
    if (rows.length !== 1) {
        throw new Error(`Expected exactly one result: ${rows.length}`);
    }
    return rows[0].data;
}

function toKeys(key: Key | Key[]) {
    if (Array.isArray(key)) {
        return new Set(key);
    }
    return new Set([key]);
}
