import type { Client, QueryResult } from "pg";

export type RegisteredNode = {
  id: string;
  has_exit_node: boolean;
  chain_id: number;
  hoprd_api_endpoint: string;
  hoprd_api_token: string;
  exit_node_pub_key?: string;
  native_address: string;
  total_amount_funded: number;
  honesty_score: number;
  reason?: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export function entryNodes(
  client: Client
): Promise<QueryResult<RegisteredNode[]>> {
  return client.query(
    "select * from registered_nodes where has_exit_node = false"
  );
}

export async function exitNodes(
  client: Client
): Promise<QueryResult<RegisteredNode[]>> {
  return client.query(
    "select * from registered_nodes where has_exit_node = true"
  );
}
