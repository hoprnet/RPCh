/**
 * Represents a response from the API for getting an access token.
 */
export type GetAccessTokenResponse = {
  /** The access token. */
  accessToken: string;
  /** The date/time when the access token will expire. */
  expiredAt: string;
  /** The amount of funding remaining to the access token. */
  amountLeft: string;
};

/**
 * Represents a request to the API for funding.
 */
export type PostFundingRequest = {
  /** The amount to be funded. */
  amount: string;
  /** The ID of the blockchain chain. */
  chainId: number;
};

/**
 * Represents a response from the API for funding.
 */
export type PostFundingResponse = {
  /** The ID of the funding request. */
  id: number;
  /** The amount of funding remaining to the access token. */
  amountLeft: string;
};

/**
 * Represents a response from the API for getting the status of a funding request.
 */
export type GetRequestStatusResponse = {
  /** The amount of the funding request. */
  amount: string;
  /** The hash of the access token. */
  accessTokenHash: string;
  /** The address of the blockchain node. */
  nodeAddress: string;
  /** The ID of the blockchain chain. */
  chainId: number;
  /** The date/time when the funding request was created. */
  createdAt: Date;
  /** The ID of the funding request. */
  requestId: number;
  /** The status of the funding request, if available. */
  status?: RequestStatus;
};

/**
 * Represents the possible status values for a funding request.
 */
type RequestStatus =
  | "FRESH"
  | "PROCESSING"
  | "FAILED-DURING-PROCESSING"
  | "REJECTED-DURING-PROCESSING"
  | "PENDING"
  | "SUCCESS"
  | "FAILED";
