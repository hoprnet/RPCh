import type { Client } from "pg";

export function entryNodes(client: Client) {
  return client.query(
    "select * from registered_nodes where has_exit_node = false"
  );
}

export async function exitNodes(client: Client) {
  return client.query(
    "select * from registered_nodes where has_exit_node = true"
  );
}
