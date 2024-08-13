import type { Pool } from 'pg';

export type Attrs = {
    rpcMethod?: string;
    segmentCount: number;
    lastSegmentLength?: number;
    chainId?: string;
    domain?: string;
};

export function createRequest(dbPool: Pool, nodeId: string, clientId: string, attrs: Attrs) {
    const q = [
        'insert into request_quotas',
        '(id, client_id, rpc_method, segment_count, reported_by_id, last_segment_length, chain_id, domain)',
        'values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)',
    ].join(' ');

    const vals = [
        clientId,
        attrs.rpcMethod,
        attrs.segmentCount,
        nodeId,
        attrs.lastSegmentLength,
        attrs.chainId,
        attrs.domain,
    ];
    return dbPool.query(q, vals);
}

export function createResponse(dbPool: Pool, nodeId: string, clientId: string, attrs: Attrs) {
    const q = [
        'insert into response_quotas',
        '(id, client_id, rpc_method, segment_count, reported_by_id, last_segment_length, chain_id, domain)',
        'values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)',
    ].join(' ');

    const vals = [
        clientId,
        attrs.rpcMethod,
        attrs.segmentCount,
        nodeId,
        attrs.lastSegmentLength,
        attrs.chainId,
        attrs.domain,
    ];
    return dbPool.query(q, vals);
}

export async function wrapMonthlyQuotas(dbPool: Pool) {
    const qQuery = [
        'select user_id from monthly_quota_usages',
        "where started_at + interval '1 month' < now()",
    ].join(' ');
    const { rows } = await dbPool.query({ text: qQuery, rowMode: 'array' });
    const userIds = rows.flat() as string[];
    const amount = userIds.length;
    if (amount === 0) {
        return amount;
    }
    await doWrapMonthlyQuotas(dbPool, userIds);
    return amount;
}

async function doWrapMonthlyQuotas(dbPool: Pool, userIds: string[]) {
    const idxs = Array.from({ length: userIds.length }, (_, idx) => `$${idx + 1}`);

    // history table columns
    const cols = [
        'id',
        'user_id',
        'started_at',
        'ended_at',
        'req_count',
        'resp_count',
        'req_segment_count',
        'resp_segment_count',
    ];

    // mapping from monthly quota table
    const colMapping: Record<string, string> = {
        id: 'gen_random_uuid() as id',
        user_id: 'user_id',
        started_at: 'started_at',
        ended_at: "started_at + interval '1 month' as ended_at",
        req_count: 'req_count',
        resp_count: 'resp_count',
        req_segment_count: 'req_segment_count',
        resp_segment_count: 'resp_segment_count',
    };

    // insert into history quota table
    const qIns = [
        'insert into monthly_quota_usage_histories',
        `(${cols.join(',')})`,
        'select',
        cols.map((c) => colMapping[c]).join(','),
        'from monthly_quota_usages',
        `where user_id in (${idxs.join(',')})`,
    ].join(' ');

    // update monthly quota table
    const qUpd = [
        'update monthly_quota_usages set',
        [
            "started_at = started_at + interval '1 month'",
            'req_count = 0',
            'resp_count = 0',
            'req_segment_count = 0',
            'resp_segment_count = 0',
        ].join(','),
        `where user_id in (${idxs.join(',')})`,
    ].join(' ');

    // run as transaction
    const client = await dbPool.connect();
    try {
        await client.query('begin');
        await client.query(qIns, userIds);
        await client.query(qUpd, userIds);
        await client.query('commit');
    } catch (err) {
        await client.query('rollback');
        throw err;
    } finally {
        client.release();
    }
}
