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

export type Token = {
    id: string;
    exitId: string;
    accessToken: string;
    invalidatedAt?: Date;
    createdAt: Date;
    updatedAt?: Date;
};

export type NodeAttrs = {
    id: string;
    isExitNode: boolean;
    chainId: number;
    hoprdApiEndpoint: string;
    hoprdApiToken: string;
    exitNodePubKey?: string;
    nativeAddress: string;
};

export type Node = {
    id: string;
    isExitNode: boolean;
    chainId: number;
    hoprdApiEndpoint: string;
    hoprdApiToken: string;
    exitNodePubKey?: string;
    nativeAddress: string;
    createdAt: Date;
    updatedAt?: Date;
};

/*
type DBnode = {
  id: string;
  is_exit_node: boolean;
  chain_id: number;
  hoprd_api_endpoint: string;
  hoprd_api_token: string;
  exit_node_pub_key?: string;
  native_address: string;
  created_at: Date;
  updated_at?: Date;
};

type DBtoken = {
  id: string;
  exit_id: string;
  access_token: string;
  invalidated_at?: Date;
  created_at: Date;
  updated_at?: Date;
};
*/

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

export function createNode(dbPool: Pool, node: Node) {
    const cols = [
        'id',
        'is_exit_node',
        'chain_id',
        'hoprd_api_endpoint',
        'hoprd_api_token',
        'native_address',
    ];
    const vals = [
        node.id,
        node.isExitNode,
        node.chainId,
        node.hoprdApiEndpoint,
        node.hoprdApiToken,
        node.nativeAddress,
    ];
    if (node.isExitNode) {
        cols.push('exit_node_pub_key');
        vals.push(node.exitNodePubKey as string);
    }
    const valIdxs = vals.map((_e, idx) => `$${idx + 1}`);
    const q = [
        'insert into registered_nodes',
        `(${cols.join(',')})`,
        `values (${valIdxs.join(',')})`,
    ].join(' ');
    return dbPool.query(q, vals);
}

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

export function listZeroHopPairings(
    dbPool: Pool,
    amount: number,
    since?: string
): Promise<Pairing[]> {
    const qSelect = 'select * from zero_hop_pairings';
    const qOrder = `order by random() limit ${amount}`;
    if (since) {
        const q = [qSelect, 'where created_at > $1', qOrder].join(' ');
        // postgres time resolution is higher than js
        // need to add 1 to timestamp to avoid rounding errors confusion when comparing timestamps
        // this can cause other confusion but will be fine for our use case
        const dSince = new Date(since);
        const date = new Date(dSince.getTime() + 1);
        return dbPool.query(q, [date]).then((r) => r.rows.map(pairingFromDB));
    }
    const q = [qSelect, qOrder].join(' ');
    return dbPool.query(q).then((r) => r.rows.map(pairingFromDB));
}

export function listPairings(
    dbPool: Pool,
    amount: number,
    since?: string,
    forceZeroHop?: boolean
): Promise<Pairing[]> {
    const t = forceZeroHop ? 'zero_hop_pairings' : 'one_hop_pairings';
    const qSelect = `select * from ${t}`;
    const qOrder = `order by random() limit ${amount}`;
    if (since) {
        const q = [qSelect, 'where created_at > $1', qOrder].join(' ');
        // postgres time resolution is higher than js
        // need to add 1 to timestamp to avoid rounding errors confusion when comparing timestamps
        // this can cause other confusion but will be fine for our use case
        const dSince = new Date(since);
        const date = new Date(dSince.getTime() + 1);
        return dbPool.query(q, [date]).then((r) => r.rows.map(pairingFromDB));
    }
    const q = [qSelect, qOrder].join(' ');
    return dbPool.query(q).then((r) => r.rows.map(pairingFromDB));
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

/*
function nodeFromDB(db: DBnode): Node {
  return {
    id: db.id,
    isExitNode: db.is_exit_node,
    chainId: db.chain_id,
    hoprdApiEndpoint: db.hoprd_api_endpoint,
    hoprdApiToken: db.hoprd_api_token,
    exitNodePubKey: db.exit_node_pub_key,
    nativeAddress: db.native_address,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}
*/
