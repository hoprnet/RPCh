import { CamelToSnakeCase, DBTimestamp } from "./general";

export type RegisteredNode = {
  hasExitNode: boolean;
  peerId: string;
  chainId: number;
  hoprdApiEndpoint: string;
  hoprdApiToken: string;
  exitNodePubKey: string;
  nativeAddress: string;
};

export type RegisteredNodeDB = {
  [K in keyof Omit<RegisteredNode, "peerId"> as CamelToSnakeCase<
    string & K
  >]: RegisteredNode[K];
} & DBTimestamp & {
    id: string;
    total_amount_funded: bigint;
    honesty_score: number;
    reason?: string;
    status: RegisteredNodeStatus;
  };

type RegisteredNodeStatus = "FRESH" | "FUNDING" | "UNUSABLE" | "READY";
