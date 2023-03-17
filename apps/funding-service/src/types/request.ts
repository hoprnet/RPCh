import { CamelToSnakeCase, DBTimestamp } from "./general";

export type Request = {
  accessTokenHash: string;
  nodeAddress: string;
  amount: bigint;
  transactionHash?: string;
  chainId: number;
  reason?: string;
  status: RequestStatus;
};

type RequestStatus =
  | "FRESH"
  | "PROCESSING"
  | "FAILED-DURING-PROCESSING"
  | "REJECTED-DURING-PROCESSING"
  | "PENDING"
  | "SUCCESS"
  | "FAILED";

export type RequestDB = {
  [K in keyof Request as CamelToSnakeCase<string & K>]: Request[K];
} & { id: number } & DBTimestamp;
