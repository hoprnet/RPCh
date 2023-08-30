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
  const qIds = Array.from(node_ids)
    .map((i) => `'${i}'`)
    .join(",");
  const q = `select id, hoprd_api_endpoint, hoprd_api_token from registered_nodes where id in (${qIds})`;
  return dbPool.query(q);
}

export function readExitNodes(
  dbPool: Pool,
  node_ids: Iterable<string>
): Promise<QueryResult<ExitNode>> {
  const qIds = Array.from(node_ids)
    .map((i) => `'${i}'`)
    .join(",");
  const q = `select id, exit_node_pub_key from registered_nodes where id in (${qIds})`;
  return dbPool.query(q);
}

export function readZeroHopPairings(
  dbPool: Pool,
  amount: number,
  since?: string
): Promise<QueryResult<Pairing>> {
  const qSelect = "select * from zero_hop_pairings";
  const qOrder = `order by random() limit ${amount}`;
  if (since) {
    const q = [qSelect, "where created_at > $1", qOrder].join(" ");
    // postgres time resolution is higher than js
    // need to add 1 to timestamp to avoid rounding errors confusion when comparing timestamps
    // this can cause other confusion but will be fine for our use case
    const dSince = new Date(since);
    const date = new Date(dSince.getTime() + 1);
    return dbPool.query(q, [date]);
  }
  const q = [qSelect, qOrder].join(" ");
  return dbPool.query(q);
}

export function readClientIds(
  dbPool: Pool,
  clientId: string
): Promise<QueryResult<{ id: string }>> {
  const q = [
    "select id from clients",
    `where external_token = '${clientId}' and`,
    "(invalidated_at is null or invalidated_at > now())",
  ].join(" ");
  return dbPool.query(q);
}
