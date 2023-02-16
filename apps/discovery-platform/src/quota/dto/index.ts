export type CreateQuota = {
  clientId: string;
  paidBy: string;
  quota: number;
  actionTaker: string;
};
export type QueryQuota = {
  id: number;
  client_id: string;
  paid_by: string;
  quota: number;
  action_taker: string;
  created_at: string;
  updated_at: string;
};
