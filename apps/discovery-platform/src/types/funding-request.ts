import { CamelToSnakeCase, DBTimestamp } from "./general";

export type FundingRequest = {
  registeredNodeId: string;
  requestId: number;
  amount: bigint;
};

export type FundingRequestDB = {
  [K in keyof FundingRequest as CamelToSnakeCase<
    string & K
  >]: FundingRequest[K];
} & DBTimestamp;
