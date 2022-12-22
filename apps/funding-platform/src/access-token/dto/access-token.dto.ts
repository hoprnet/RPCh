type AccessToken = {
  Token: string;
};
export type CreateAccessToken = AccessToken & {
  Id?: number;
  ExpiredAt: string;
  CreatedAt: string;
};

export type QueryAccessToken = AccessToken & {
  Id: number;
  ExpiredAt: string;
  CreatedAt: string;
};
