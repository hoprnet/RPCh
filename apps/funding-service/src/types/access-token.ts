import { CamelToSnakeCase, DBTimestamp } from "./general";

export type AccessToken = {
  token: string;
  expiredAt: string;
  createdAt: string;
};

export type AccessTokenDB = {
  [K in keyof AccessToken as CamelToSnakeCase<string & K>]: AccessToken[K];
} & DBTimestamp & { id: number };
