type Request = {
  requestId: number;
  createdAt: string;
  nodeAddress: string;
  amount: number;
  transactionHash: string;
  chainId: number;
  reason: string;
  status: string;
};

export type CreateRequest = Request & {};

export type UpdateRequest = Request & {};

export type QueryRequest = Request & {};
