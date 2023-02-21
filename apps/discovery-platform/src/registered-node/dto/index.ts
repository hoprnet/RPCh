type RegisteredNode = {
  hasExitNode: boolean;
  peerId: string;
  chainId: number;
};

export type CreateRegisteredNode = RegisteredNode & {
  hoprdApiEndpoint: string;
  hoprdApiToken: string;
  exitNodePubKey: string;
  nativeAddress: string;
};

export type QueryRegisteredNode = {
  id: string;
  has_exit_node: boolean;
  hoprd_api_endpoint: string;
  hoprd_api_token: string;
  exit_node_pub_key: string;
  native_address: string;
  chain_id: number;
  total_amount_funded: bigint;
  honesty_score: number;
  reason?: string;
  status: RegisteredNodeStatus;
  created_at: string;
  updated_at: string;
};

type RegisteredNodeStatus = "FRESH" | "FUNDING" | "UNUSABLE" | "READY";
