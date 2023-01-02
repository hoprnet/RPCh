type AccessToken = {
  token: string;
};
export type CreateAccessToken = AccessToken & {
  id?: number;
  expiredAt: string;
  createdAt: string;
};

export type QueryAccessToken = AccessToken & {
  id: number;
  expired_at: string;
  created_at: string;
};
