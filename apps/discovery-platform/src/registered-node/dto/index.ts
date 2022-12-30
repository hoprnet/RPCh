type RegisteredNode = {
  hasExitNode: boolean;
  peerId: string;
  chainId: number;
};

export type CreateRegisteredNode = RegisteredNode & {
  ports: {
    hoprApiEndpoint: string;
    hoprApiPort: number;
    exitNodePort: number;
  };
};

export type QueryRegisteredNode = {
  id: string;
  has_exit_node: boolean;
  chain_id: number;
  total_amount_funded: number;
  honesty_score: number;
  reason?: string;
  status: RegisteredNodeStatus;
  created_at: string;
  updated_at: string;
};

type RegisteredNodeStatus = "FRESH" | "FUNDING" | "UNUSABLE" | "READY";
