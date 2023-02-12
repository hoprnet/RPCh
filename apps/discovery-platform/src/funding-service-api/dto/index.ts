export type getAccessTokenResponse = {
  accessToken: string;
  expiredAt: string;
  amountLeft: bigint;
};

export type postFundingRequest = {
  amount: bigint;
  chainId: number;
};

export type postFundingResponse = {
  id: number;
  amountLeft: bigint;
};

export type getRequestStatusResponse = {
  amount: bigint;
  accessTokenHash: string;
  nodeAddress: string;
  chainId: number;
  createdAt: Date;
  requestId: number;
  status?: RequestStatus;
};

type RequestStatus =
  | "FRESH"
  | "PROCESSING"
  | "FAILED-DURING-PROCESSING"
  | "REJECTED-DURING-PROCESSING"
  | "PENDING"
  | "SUCCESS"
  | "FAILED";
