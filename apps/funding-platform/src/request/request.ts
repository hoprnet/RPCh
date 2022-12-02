export interface Request {
  requestId: number;
  createdAt: string;
  nodeAddress: string;
  amount: number;
  transactionHash: string;
  chainId: number;
  reason: string;
  status: string;
}
