export type CreateQuota = {
  clientId: string;
  quota: bigint;
  actionTaker: string;
};
export type QueryQuota = {
  id: number;
  client_id: string;
  quota: bigint;
  action_taker: string;
  created_at: string;
  updated_at: string;
};
