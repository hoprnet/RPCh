import type { Pool, QueryResult } from 'pg';

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

export function entryNodes(dbPool: Pool): Promise<QueryResult<RegisteredNode>> {
    return dbPool.query('select * from registered_nodes where is_exit_node = false');
}

export function exitNodes(dbPool: Pool): Promise<QueryResult<RegisteredNode>> {
    return dbPool.query('select * from registered_nodes where is_exit_node = true');
}

export function writeZeroHopPairings(dbPool: Pool, pairings: Pair[]): Promise<QueryResult<any>> {
    return writePairings(dbPool, 'zero_hop_pairings', pairings);
}

export function writeOneHopPairings(dbPool: Pool, pairings: Pair[]): Promise<QueryResult<any>> {
    return writePairings(dbPool, 'one_hop_pairings', pairings);
}

function writePairings(dbPool: Pool, table: string, pairings: Pair[]): Promise<QueryResult<any>> {
    return new Promise((resolve, reject) => {
        dbPool
            .connect()
            .then(async (client) => {
                try {
                    await client.query('begin');
                    await client.query(`delete from ${table}`);
                    const inserts = pairings.map(
                        ({ entryId, exitId }) =>
                            `insert into ${table} (entry_id, exit_id) values ('${entryId}', '${exitId}');`
                    );
                    inserts.forEach(async (i) => await client.query(i));
                    resolve(client.query('commit'));
                } catch (e) {
                    await client.query('rollback');
                    reject(e);
                } finally {
                    client.release();
                }
            })
            .catch((e) => {
                reject(e);
            });
    });
}
