import type { Pool, QueryResult } from 'pg';
import type { Keys } from './configs';

export type UserAttrs = {
    name?: string;
    email?: string;
    www_address?: string;
    telegram?: string;
};

export type User = UserAttrs & {
    id: string;
    name?: string;
    email?: string;
    www_address?: string;
    telegram?: string;
    last_logged_in_at?: Date;
    mev_kickback_address?: string;
    mev_current_choice?: string;
    created_at: Date;
    updated_at?: Date;
};

export type ChainCredential = {
    user_id: string;
    address: string;
    chain: string;
};

export type FederatedCredential = {
    user_id: string;
    provider: string;
    subject: string;
};

export async function readConfig(dbPool: Pool, key: keyof Keys): Promise<string> {
    const q = 'select data from configs where key = $1';
    const { rows } = await dbPool.query(q, [key]);
    if (rows.length !== 1) {
        throw new Error(`Expected exactly one result: ${rows.length}`);
    }
    return rows[0].data;
}

export function createUser(dbPool: Pool, attrs: UserAttrs): Promise<QueryResult<User>> {
    const cols = ['name', 'email', 'www_address', 'telegram'];
    const vals = [attrs.name, attrs.email, attrs.www_address, attrs.telegram];
    const valIdxs = vals.map((_e, idx) => `$${idx + 1}`);
    // handle id separate
    const q = [
        'insert into users',
        `(id, ${cols.join(',')})`,
        `values (gen_random_uuid(), ${valIdxs.join(',')})`,
        'returning *',
    ].join(' ');
    return dbPool.query(q, vals);
}

export function readUserById(dbPool: Pool, id: string): Promise<QueryResult<User>> {
    const q = 'select * from users where id = $1';
    return dbPool.query(q, [id]);
}

export function readUserByChainCred(
    dbPool: Pool,
    address: string,
    chain: string,
): Promise<QueryResult<User>> {
    const q = [
        'select * from users',
        'where id = (select user_id from chain_credentials',
        'where chain = $1 and address = $2)',
    ].join(' ');
    return dbPool.query(q, [chain, address]);
}

export function readUserByFederatedCred(
    dbPool: Pool,
    provider: string,
    subject: string,
): Promise<QueryResult<User>> {
    const q = [
        'select * from users',
        'where id = (select user_id from federated_credentials',
        'where provider = $1 and subject = $2)',
    ].join(' ');
    return dbPool.query(q, [provider, subject]);
}

export function createChainCredential(dbPool: Pool, attrs: ChainCredential) {
    const cols = ['user_id', 'address', 'chain'];
    const vals = [attrs.user_id, attrs.address, attrs.chain];
    const valIdxs = vals.map((_e, idx) => `$${idx + 1}`);
    const q = [
        'insert into chain_credentials',
        `(${cols.join(',')})`,
        `values (${valIdxs.join(',')})`,
    ].join(' ');
    return dbPool.query(q, vals);
}

export function createFederatedCredential(dbPool: Pool, attrs: FederatedCredential) {
    const cols = ['user_id', 'provider', 'subject'];
    const vals = [attrs.user_id, attrs.provider, attrs.subject];
    const valIdxs = vals.map((_e, idx) => `$${idx + 1}`);
    const q = [
        'insert into federated_credentials',
        `(${cols.join(',')})`,
        `values (${valIdxs.join(',')})`,
    ].join(' ');
    return dbPool.query(q, vals);
}
