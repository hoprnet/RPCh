export type CreateQuota = {
  clientId: string;
  paidBy: string;
  quota: bigint;
  actionTaker: string;
};
export type QueryQuota = {
  id: number;
  client_id: string;
  paid_by: string;
  quota: bigint;
  action_taker: string;
  created_at: string;
  updated_at: string;
};
