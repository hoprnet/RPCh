import * as pg from 'pg';

export enum Keys {
    RPCh_DOCKER_COMMAND_PARAMS = 'RPCh_DOCKER_COMMAND_PARAMS',
    RPCh_DOCKER_IMAGE = 'RPCh_DOCKER_IMAGE',
    RPCh_DOCKER_IMAGE_VERSION = 'RPCh_DOCKER_IMAGE_VERSION',
    RPCh_PROVIDER_ETHEREUM = 'RPCh_PROVIDER_ETHEREUM',
    RPCh_PROVIDER_GNOSIS = 'RPCh_PROVIDER_GNOSIS',
    RPCh_RPC_SERVER_VERSION = 'RPCh_RPC_SERVER_VERSION',
    RPCh_SDK_VERSION = 'RPCh_SDK_VERSION',
    RPCh_URL_PROVIDER_BASE = 'RPCh_URL_PROVIDER_BASE',
}

export async function readConfig(dbPool: pg.Pool, key: Keys): Promise<string | undefined> {
    const q = 'select data from configs where key = $1';
    const { rows } = await dbPool.query(q, [key]);
    return rows[0]?.data;
}
