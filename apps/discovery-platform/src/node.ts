import crypto from 'crypto';
import type { Pool } from 'pg';

export type Pairing = {
    entryId: string;
    exitId: string;
    createdAt: Date;
};

export type EntryNode = {
    id: string;
    apiEndpoint: string;
    accessToken: string;
};

export type ExitNode = {
    id: string;
    pubKey: string;
};

type DBPairing = {
    entry_id: string;
    exit_id: string;
    created_at: Date;
};

type DBEntryNode = {
    id: string;
    hoprd_api_endpoint: string;
    hoprd_api_token: string;
};

type DBExitNode = {
    id: string;
    exit_node_pub_key: string;
};

export function createToken(dbPool: Pool, nodeId: string): Promise<{ accessToken: string }[]> {
    const q = [
        'insert into exit_node_tokens',
        '(id, exit_id, access_token)',
        'values (gen_random_uuid(), $1, $2)',
        'returning access_token',
    ].join(' ');

    const token = crypto.randomBytes(24).toString('hex');
    const vals = [nodeId, token];
    return dbPool
        .query(q, vals)
        .then((q) => q.rows.map(({ access_token }) => ({ accessToken: access_token })));
}

export function listEntryNodes(dbPool: Pool, nodeIds: Iterable<string>): Promise<EntryNode[]> {
    const qIds = Array.from(nodeIds)
        .map((i) => `'${i}'`)
        .join(',');
    const q = `select id, hoprd_api_endpoint, hoprd_api_token from registered_nodes where id in (${qIds})`;
    return dbPool.query(q).then((r) => r.rows.map(entryNodeFromDB));
}

export function listExitNodes(dbPool: Pool, nodeIds: Iterable<string>): Promise<ExitNode[]> {
    const qIds = Array.from(nodeIds)
        .map((i) => `'${i}'`)
        .join(',');
    const q = `select id, exit_node_pub_key from registered_nodes where id in (${qIds})`;
    return dbPool.query(q).then((r) => r.rows.map(exitNodeFromDB));
}

/**
 * Queries database for routes matching requested number of hops.
 * Will try to fetch routes matching as many different exit nodes as possible.
 * Choosing entry nodes and additional entry exit node pairs at random.
 */
export function listPairings(
    dbPool: Pool,
    amount: number,
    forceZeroHop?: boolean
): Promise<Pairing[]> {
    const table = forceZeroHop ? 'zero_hop_pairings' : 'one_hop_pairings';
    const sub1 = 'max_rand_exits';
    const sub2 = 'remaining_routes';
    // select each exit exactly once with a random entry_id
    const qMaxRandExits = [
        `select distinct on (exit_id) * from ${table}`,
        `order by exit_id, random() limit ${amount}`,
    ].join(' ');
    // select new random entry_id - exit_id combinations until we reach **amount**
    const qRemainingRoutes = [
        `select * from ${table}`,
        `where (entry_id,exit_id) not in (select entry_id, exit_id from ${sub1})`,
        `order by random() limit (${amount} - (select count(*) from ${sub1}))`,
    ].join(' ');
    // union subqueries for final result
    const qUnion = [
        `with ${sub1} as (${qMaxRandExits}), ${sub2} as (${qRemainingRoutes})`,
        `select * from ${sub1} union all select * from ${sub2}`,
    ].join(' ');
    return dbPool.query(qUnion).then((r) => r.rows.map(pairingFromDB));
}

export function listIdsByAccessToken(
    dbPool: Pool,
    accessToken: string
): Promise<{ exitId: string }[]> {
    const q = [
        'select exit_id from exit_node_tokens',
        'where access_token = $1',
        'and (invalidated_at is null or invalidated_at > now())',
    ].join(' ');
    return dbPool
        .query(q, [accessToken])
        .then((q) => q.rows.map(({ exit_id }) => ({ exitId: exit_id })));
}

function entryNodeFromDB(db: DBEntryNode): EntryNode {
    return {
        id: db.id,
        apiEndpoint: db.hoprd_api_endpoint,
        accessToken: db.hoprd_api_token,
    };
}

function exitNodeFromDB(db: DBExitNode): ExitNode {
    return {
        id: db.id,
        pubKey: db.exit_node_pub_key,
    };
}

function pairingFromDB(db: DBPairing): Pairing {
    return {
        entryId: db.entry_id,
        exitId: db.exit_id,
        createdAt: db.created_at,
    };
}
