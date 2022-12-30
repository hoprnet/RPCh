export type CreateQuota = {
  client: string;
  quota: number;
  actionTaker: string;
};
export type QueryQuota = {
  id: number;
  client: string;
  quota: number;
  action_taker: string;
  created_at: string;
  updated_at: string;
};
