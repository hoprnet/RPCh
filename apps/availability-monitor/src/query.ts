import type { Pool } from 'pg';
import { Utils } from '@rpch/sdk';

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

export type Pair = {
    entryId: string;
    exitId: string;
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

export async function writeZeroHopPairings(dbPool: Pool, pairings: Pair[]) {
    return writePairings(dbPool, 'zero_hop_pairings', pairings);
}

export async function writeOneHopPairings(dbPool: Pool, pairings: Pair[]) {
    return writePairings(dbPool, 'one_hop_pairings', pairings);
}

async function writePairings(dbPool: Pool, table: string, pairings: Pair[]) {
    const qDel = `delete from ${table}`;
    const qIns = [
        `insert into ${table} (entry_id, exit_id) values`,
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

export function prettyPrint(node: RegisteredNode) {
    const prefix = node.is_exit_node ? 'x' : 'e';
    return `${prefix}${Utils.shortPeerId(node.id)}[${node.hoprd_api_endpoint},${node.id}]`;
}
