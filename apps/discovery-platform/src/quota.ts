import type { Pool } from "pg";

export type Attrs = {
  clientId: string;
  rpcMethod?: string;
  segmentCount: number;
};

export function createRequest(dbPool: Pool, nodeId: string, attrs: Attrs) {
  const q = [
    "insert into request_quotas",
    "(id, client_id, rpc_method, segment_count, reported_by_id)",
    "values(gen_random_uuid(), $1, $2, $3, $4)",
    "returning *",
  ].join(" ");

  const vals = [attrs.clientId, attrs.rpcMethod, attrs.segmentCount, nodeId];
  return dbPool.query(q, vals);
}

export function createResponse(dbPool: Pool, nodeId: string, attrs: Attrs) {
  const q = [
    "insert into response_quotas",
    "(id, client_id, rpc_method, segment_count, reported_by_id)",
    "values(gen_random_uuid(), $1, $2, $3, $4)",
    "returning *",
  ].join(" ");

  const vals = [attrs.clientId, attrs.rpcMethod, attrs.segmentCount, nodeId];
  return dbPool.query(q, vals);
}
