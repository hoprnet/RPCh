type Request = {
  requestId: number;
  accessTokenHash: string;
  createdAt: string;
  nodeAddress: string;
  amount: string;
  transactionHash?: string;
  chainId: number;
  reason?: string;
  status?: RequestStatus;
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

export type UpdateRequest = Request & {};

export type QueryRequest = Request & {};
