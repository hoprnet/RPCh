export type getAccessTokenResponse = {
  accessToken: string;
  expiredAt: string;
  amountLeft: number;
};

export type postFundingRequest = {
  amount: string;
  chainId: number;
};

export type postFundingResponse = {
  id: number;
  amountLeft: number;
};

export type getRequestStatusResponse = {
  amount: string;
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
