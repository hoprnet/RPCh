type Request = {
  accessTokenHash: string;
  nodeAddress: string;
  amount: bigint;
  transactionHash?: string;
  chainId: number;
  reason?: string;
  status: RequestStatus;
};

type RequestStatus =
  | "FRESH"
  | "PROCESSING"
  | "FAILED-DURING-PROCESSING"
  | "REJECTED-DURING-PROCESSING"
  | "PENDING"
  | "SUCCESS"
  | "FAILED";

export type CreateRequest = Request & {};

export type UpdateRequest = Request & {
  id: number;
};

export type QueryRequest = {
  id: number;
  access_token_hash: string;
  created_at: string;
  node_address: string;
  amount: bigint;
  transaction_hash?: string;
  chain_id: number;
  reason?: string;
  status: RequestStatus;
};
