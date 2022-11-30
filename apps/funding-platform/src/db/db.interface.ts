import { CreateAccessToken, QueryAccessToken } from "access-token/dto";

export interface DBInterface {
  saveAccessToken: (accessToken: CreateAccessToken) => void;
  getAccessToken: (accessTokenHash: string) => QueryAccessToken;
  deleteAccessToken: (accessTokenHash: string) => void;
  createRequest: (request: unknown) => void;
  getRequestsByToken: (request: unknown) => void;
  updateRequest: (request: unknown) => void;
  deleteRequest: (request: unknown) => void;
}
