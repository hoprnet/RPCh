import type { Pool, QueryResult } from "pg";

export type Pairing = {
  entry_id: string;
  exit_id: string;
  created_at: Date;
};

export type EntryNode = {
  id: string;
  hoprd_api_endpoint: string;
  hoprd_api_token: string;
};

export type ExitNode = {
  id: string;
  exit_node_pub_key: string;
};

export function readEntryNodes(
  dbPool: Pool,
  node_ids: Iterable<string>
): Promise<QueryResult<EntryNode>> {
  const qIds = Array.from(node_ids).join(",");
  const q = `select id, hoprd_api_endpoint, hoprd_api_token from registered_node where id in (${qIds})`;
  return dbPool.query(q);
}

export function readExitNodes(
  dbPool: Pool,
  node_ids: Iterable<string>
): Promise<QueryResult<ExitNode>> {
  const qIds = Array.from(node_ids).join(",");
  const q = `select id, exit_node_pub_key where id in (${qIds})`;
  return dbPool.query(q);
}

export function readZeroHopPairings(
  dbPool: Pool,
  amount: number,
  since?: Date
): Promise<QueryResult<Pairing>> {
  const qSince = since ? `where created_at > ${since}` : "";
  const q = `select * from zero_hop_pairings ${qSince} order by random() limit ${amount}`;
  return dbPool.query(q);
}
