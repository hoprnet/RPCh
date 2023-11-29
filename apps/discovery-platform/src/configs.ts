import * as pg from 'pg';

export enum Keys {
    RPCh_RPC_SERVER_VERSION = 'RPCh_RPC_SERVER_VERSION',
    RPCh_SDK_VERSION = 'RPCh_SDK_VERSION',
}

export async function readConfig(dbPool: pg.Pool, key: Keys): Promise<string | undefined> {
    const q = 'select data from configs where key = $1';
    const { rows } = await dbPool.query(q, [key]);
    return rows[0]?.data;
}
