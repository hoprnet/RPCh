import { CamelToSnakeCase, DBTimestamp } from "./general";

export type Quota = {
  clientId: string;
  paidBy: string;
  quota: bigint;
  token?: string;
  actionTaker: string;
};

export type QuotaDB = {
  [K in keyof Quota as CamelToSnakeCase<string & K>]: Quota[K];
} & DBTimestamp & { id: number };
