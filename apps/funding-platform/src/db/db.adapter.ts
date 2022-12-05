import { CreateAccessToken, QueryAccessToken } from "../access-token";
import { Low } from "lowdb";
import { CreateRequest, QueryRequest, UpdateRequest } from "../request";

export type Data = {
  accessTokens: QueryAccessToken[];
  requests: QueryRequest[];
};

export type DBInstance = Low<Data>;

export const saveAccessToken = async (
  db: DBInstance,
  accessToken: CreateAccessToken
): Promise<void> => {
  const res = db.data?.accessTokens.push({
    ...accessToken,
    Id: Math.floor(Math.random() * 1e6),
  } as QueryAccessToken);
};

export const getAccessToken = async (
  db: DBInstance,
  accessTokenHash: string
): Promise<QueryAccessToken | undefined> => {
  const accessToken = await db.data?.accessTokens.find(
    (a) => a.Token === accessTokenHash
  );

  return accessToken;
};

export const deleteAccessToken = async (
  db: DBInstance,
  accessTokenHash: string
): Promise<boolean> => {
  const accessTokensLengthBefore = db.data?.accessTokens.length;
  const filteredAccessTokens = await db.data?.accessTokens.filter(
    (a) => a.Token !== accessTokenHash
  );
  db.data = {
    accessTokens: filteredAccessTokens,
    requests: db.data?.requests,
  } as Data;

  return (filteredAccessTokens?.length ?? 0) < (accessTokensLengthBefore ?? 0);
};

export const saveRequest = async (
  db: DBInstance,
  request: CreateRequest
): Promise<void> => {
  db.data?.requests.push({
    ...request,
  });
};
export const getRequest = async (db: DBInstance, requestId: number) => {
  const request = db.data?.requests.find((req) => req.requestId === requestId);
  return request;
};
export const getRequestsByAccessToken = async (db: DBInstance) => {
  const requests = db.data?.requests;

  return requests;
};
export const updateRequest = async (db: DBInstance, request: UpdateRequest) => {
  const updatedRequests = db.data?.requests.map((tReq) =>
    tReq.requestId === request.requestId ? { ...tReq, ...request } : tReq
  );
  db.data = {
    accessTokens: db.data?.accessTokens,
    requests: updatedRequests,
  } as Data;
};

export const deleteRequest = async (db: DBInstance, requestId: number) => {
  const accessTokensLengthBefore = db.data?.accessTokens.length;
  const filteredRequests = await db.data?.requests.filter(
    (a) => a.requestId !== requestId
  );
  db.data = {
    accessTokens: db.data?.accessTokens,
    requests: filteredRequests,
  } as Data;

  return (filteredRequests?.length ?? 0) < (accessTokensLengthBefore ?? 0);
};
