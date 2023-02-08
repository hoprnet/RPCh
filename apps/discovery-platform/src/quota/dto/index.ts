export type CreateQuota = {
  clientId: string;
  quota: number;
  actionTaker: string;
};
export type QueryQuota = {
  id: number;
  client_id: string;
  quota: number;
  action_taker: string;
  created_at: string;
  updated_at: string;
};
