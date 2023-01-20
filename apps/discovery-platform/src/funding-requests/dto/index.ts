export type QueryFundingRequest = {
  id: number;
  registered_node_id: string;
  amount: string;
  request_id: number;
  created_at: string;
  updated_at: string;
};

export type CreateFundingRequest = {
  registeredNodeId: string;
  requestId: number;
  amount: string;
};
