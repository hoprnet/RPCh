type AccessToken = {
  Token: string;
  ExpiredAt: string;
  CreatedAt: string;
};
export type CreateAccessToken = AccessToken & {
  Id?: number;
};

export type QueryAccessToken = {
  Id: number;
};
