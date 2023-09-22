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

export type RegisteredNode = {
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

export function createUser(
  dbPool: Pool,
  attrs: UserAttrs
): Promise<QueryResult<User>> {
  const cols = ["name", "email", "www_address", "telegram"];
  const vals = [attrs.name, attrs.email, attrs.www_address, attrs.telegram];
  const valIdxs = vals.map((_e, idx) => `$${idx + 1}`);
  // handle id separate
  const q = [
    "insert into users",
    `(id, ${cols.join(",")})`,
    `values (gen_random_uuid(), ${valIdxs.join(",")})`,
    "returning *",
  ].join(" ");
  return dbPool.query(q, vals);
}

export function readUserById(
  dbPool: Pool,
  id: string
): Promise<QueryResult<User>> {
  const q = "select * from users where id = $1";
  return dbPool.query(q, [id]);
}

export function readUserByChainCred(
  dbPool: Pool,
  address: string,
  chain: string
): Promise<QueryResult<User>> {
  const q = [
    "select * from users",
    "where id = (select user_id from chain_credentials",
    `where chain = $1 and address = $2)`,
  ].join(" ");
  return dbPool.query(q, [chain, address]);
}

export function readUserByFederatedCred(
  dbPool: Pool,
  provider: string,
  subject: string
): Promise<QueryResult<User>> {
  const q = [
    "select * from users",
    "where id = (select user_id from federated_credentials",
    `where provider = $1 and subject = $2)`,
  ].join(" ");
  return dbPool.query(q, [provider, subject]);
}

export function createChainCredential(dbPool: Pool, attrs: ChainCredential) {
  const cols = ["user_id", "address", "chain"];
  const vals = [attrs.user_id, attrs.address, attrs.chain];
  const valIdxs = vals.map((_e, idx) => `$${idx + 1}`);
  const q = [
    "insert into chain_credentials",
    `(${cols.join(",")})`,
    `values (${valIdxs.join(",")})`,
  ].join(" ");
  return dbPool.query(q, vals);
}

export function createFederatedCredential(
  dbPool: Pool,
  attrs: FederatedCredential
) {
  const cols = ["user_id", "provider", "subject"];
  const vals = [attrs.user_id, attrs.provider, attrs.subject];
  const valIdxs = vals.map((_e, idx) => `$${idx + 1}`);
  const q = [
    "insert into federated_credentials",
    `(${cols.join(",")})`,
    `values (${valIdxs.join(",")})`,
  ].join(" ");
  return dbPool.query(q, vals);
}

export function listEntryNodes(
  dbPool: Pool,
  nodeIds: Iterable<string>
): Promise<QueryResult<EntryNode>> {
  const qIds = Array.from(nodeIds)
    .map((i) => `'${i}'`)
    .join(",");
  const q = `select id, hoprd_api_endpoint, hoprd_api_token from registered_nodes where id in (${qIds})`;
  return dbPool.query(q);
}

export function listExitNodes(
  dbPool: Pool,
  nodeIds: Iterable<string>
): Promise<QueryResult<ExitNode>> {
  const qIds = Array.from(nodeIds)
    .map((i) => `'${i}'`)
    .join(",");
  const q = `select id, exit_node_pub_key from registered_nodes where id in (${qIds})`;
  return dbPool.query(q);
}

export function listZeroHopPairings(
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
