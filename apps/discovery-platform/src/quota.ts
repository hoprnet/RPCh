import type { Pool } from "pg";

export type Attrs = {
  rpcMethod?: string;
  segmentCount: number;
  lastSegmentLength?: number;
};

export function createRequest(
  dbPool: Pool,
  nodeId: string,
  clientId: string,
  attrs: Attrs
) {
  const q = [
    "insert into request_quotas",
    "(id, client_id, rpc_method, segment_count, reported_by_id, last_segment_length)",
    "values(gen_random_uuid(), $1, $2, $3, $4, $5)",
  ].join(" ");

  const vals = [
    clientId,
    attrs.rpcMethod,
    attrs.segmentCount,
    nodeId,
    attrs.lastSegmentLength,
  ];
  return dbPool.query(q, vals);
}

export function createResponse(
  dbPool: Pool,
  nodeId: string,
  clientId: string,
  attrs: Attrs
) {
  const q = [
    "insert into response_quotas",
    "(id, client_id, rpc_method, segment_count, reported_by_id, last_segment_length)",
    "values(gen_random_uuid(), $1, $2, $3, $4, $5)",
  ].join(" ");

  const vals = [
    clientId,
    attrs.rpcMethod,
    attrs.segmentCount,
    nodeId,
    attrs.lastSegmentLength,
  ];
  return dbPool.query(q, vals);
}
