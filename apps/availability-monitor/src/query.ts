import type { Pool } from 'pg';

export type RegisteredNode = {
    id: string;
    is_exit_node: boolean;
    chain_id: number;
    hoprd_api_endpoint: string;
    hoprd_api_token: string;
    exit_node_pub_key?: string;
    native_address: string;
    created_at: Date;
    updated_at: Date;
};

export type ZeroHopPair = {
    entryId: string;
    exitId: string;
};

export type OneHopPair = {
    entryId: string;
    exitId: string;
    relayId: string;
};

export async function entryNodes(dbPool: Pool): Promise<RegisteredNode[]> {
    return dbPool
        .query('select * from registered_nodes where is_exit_node = false')
        .then(({ rows }) => rows);
}

export async function exitNodes(dbPool: Pool): Promise<RegisteredNode[]> {
    return dbPool
        .query('select * from registered_nodes where is_exit_node = true')
        .then(({ rows }) => rows);
}

export async function writeZeroHopPairings(dbPool: Pool, pairings: ZeroHopPair[]) {
    const qDel = 'delete from zero_hop_pairings';
    const qIns = [
        'insert into one_hop_pairings (entry_id, exit_id) values',
        pairings.map(({ entryId, exitId }) => `('${entryId}','${exitId}')`).join(','),
    ].join(' ');

    // run as transaction
    const client = await dbPool.connect();
    try {
        await client.query('begin');
        await client.query(qDel);
        if (pairings.length > 0) {
            await client.query(qIns);
        }
        await client.query('commit');
    } catch (err) {
        await client.query('rollback');
        throw err;
    } finally {
        client.release();
    }
}

export async function writeOneHopPairings(dbPool: Pool, pairings: OneHopPair[]) {
    const qDel = 'delete from one_hop_pairings';
    const qIns = [
        'insert into one_hop_pairings (entry_id, exit_id, relay_id) values',
        pairings
            .map(({ entryId, exitId, relayId }) => `('${entryId}','${exitId}','${relayId}')`)
            .join(','),
    ].join(' ');

    // run as transaction
    const client = await dbPool.connect();
    try {
        await client.query('begin');
        await client.query(qDel);
        if (pairings.length > 0) {
            await client.query(qIns);
        }
        await client.query('commit');
    } catch (err) {
        await client.query('rollback');
        throw err;
    } finally {
        client.release();
    }
}
