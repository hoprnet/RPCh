import crypto from "crypto";
import type { Pool, QueryResult } from "pg";

export type DBnode = {
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

export type DBtoken = {
  id: string;
  exit_id: string;
  access_token: string;
  invalidated_at?: Date;
  created_at: Date;
  updated_at?: Date;
};

export type DBpartialToken = {
  access_token: string;
};

export type NodeAttrs = {
  id: string;
  isExitNode: boolean;
  chainId: number;
  hoprdApiEndpoint: string;
  hoprdApiToken: string;
  exitNodePubKey?: string;
  nativeAddress: string;
};

export type Node = {
  id: string;
  isExitNode: boolean;
  chainId: number;
  hoprdApiEndpoint: string;
  hoprdApiToken: string;
  exitNodePubKey?: string;
  nativeAddress: string;
  createdAt: Date;
  updatedAt?: Date;
};

export type PartialToken = {
  accessToken: string;
};

export function nodeFromDB(db: DBnode): Node {
  return {
    id: db.id,
    isExitNode: db.is_exit_node,
    chainId: db.chain_id,
    hoprdApiEndpoint: db.hoprd_api_endpoint,
    hoprdApiToken: db.hoprd_api_token,
    exitNodePubKey: db.exit_node_pub_key,
    nativeAddress: db.native_address,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function partialTokenFromDB(db: DBpartialToken): PartialToken {
  return { accessToken: db.access_token };
}

export function createNode(dbPool: Pool, node: Node) {
  const cols = [
    "id",
    "is_exit_node",
    "chain_id",
    "hoprd_api_endpoint",
    "hoprd_api_token",
    "native_address",
  ];
  const vals = [
    node.id,
    node.isExitNode,
    node.chainId,
    node.hoprdApiEndpoint,
    node.hoprdApiToken,
    node.nativeAddress,
  ];
  if (node.isExitNode) {
    cols.push("exit_node_pub_key");
    vals.push(node.exitNodePubKey!);
  }
  const valIdxs = vals.map((_e, idx) => `$${idx + 1}`);
  const q = [
    "insert into registered_nodes",
    `(${cols.join(",")})`,
    `values (${valIdxs.join(",")})`,
  ].join(" ");
  return dbPool.query(q, vals);
}

export function createToken(
  dbPool: Pool,
  nodeId: string
): Promise<QueryResult<Token>> {
  const q = [
    "insert into exit_node_tokens",
    "(id, exit_id, access_token)",
    "values (gen_random_uuid(), $1, $2",
    "returning access_token",
  ].join(" ");

  const token = crypto.randomBytes(24).toString("hex");
  const vals = [nodeId, token];
  return dbPool.query(q, vals);
}
