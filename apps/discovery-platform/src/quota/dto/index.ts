export type CreateQuota = {
  client: string;
  quota: number;
  createdAt: string;
  actionTaker: string;
};
export type QueryQuota = {
  id?: number;
  client: string;
  quota: number;
  created_at?: string;
  action_taker: string;
};
