export type CreateQuota = {
  client: string;
  quota: bigint;
  actionTaker: string;
};
export type QueryQuota = {
  id: number;
  client: string;
  quota: bigint;
  action_taker: string;
  created_at: string;
  updated_at: string;
};
