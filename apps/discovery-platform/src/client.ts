import crypto from 'crypto';
import type { Pool, QueryResult } from 'pg';
export type DB = {
    id: string;
    user_id: string;
    external_token: string;
    invalidated_at?: Date;
    created_at: Date;
    updated_at?: Date;
};

export type CreateAttrs = {
    invalidatedAt?: Date;
};

export type UpdateAttrs = {
    invalidatedAt: Date;
};

export type Client = {
    id: string;
    userId: string;
    externalToken: string;
    invalidatedAt?: Date;
    createdAt: Date;
    updatedAt?: Date;
};

export function mapFromDB(db: DB): Client {
    return {
        id: db.id,
        userId: db.user_id,
        externalToken: db.external_token,
        invalidatedAt: db.invalidated_at,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
}

export function create(dbPool: Pool, userId: string, attrs: CreateAttrs): Promise<QueryResult<DB>> {
    const q = [
        'insert into clients',
        '(id, user_id, external_token, invalidated_at)',
        'values(gen_random_uuid(), $1, $2, $3)',
        'returning *',
    ].join(' ');

    const token = crypto.randomBytes(24).toString('hex');
    const vals = [userId, token, attrs.invalidatedAt];
    return dbPool.query(q, vals);
}

export function del(dbPool: Pool, userId: string, id: string) {
    const q = 'delete from clients where user_id = $1 and id = $2';
    const vals = [userId, id];
    return dbPool.query(q, vals);
}

export function read(dbPool: Pool, userId: string, id: string): Promise<QueryResult<DB>> {
    const q = 'select * from clients where user_id = $1 and id = $2';
    const vals = [userId, id];
    return dbPool.query(q, vals);
}

export function update(
    dbPool: Pool,
    userId: string,
    id: string,
    attrs: UpdateAttrs
): Promise<QueryResult<DB>> {
    const q = [
        'update clients',
        'set invalidated_at = $1',
        'where user_id = $2 and id = $3',
        'returning *',
    ].join(' ');
    const vals = [attrs.invalidatedAt, userId, id];
    return dbPool.query(q, vals);
}

export function listByUserId(dbPool: Pool, userId: string): Promise<QueryResult<DB>> {
    const q = 'select * from clients where user_id = $1';
    return dbPool.query(q, [userId]);
}

export function listIdsByExternalToken(dbPool: Pool, clientId: string): Promise<{ id: string }[]> {
    const q = [
        'select id from clients',
        `where external_token = '${clientId}' and`,
        '(invalidated_at is null or invalidated_at > now())',
    ].join(' ');
    return dbPool.query(q).then((q) => q.rows);
}
