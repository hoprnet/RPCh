import { CreateAccessToken, QueryAccessToken } from "../access-token";
import { Data, DBInstance } from "../index";

export const saveAccessToken = async (
  db: DBInstance,
  accessToken: CreateAccessToken
): Promise<void> => {
  const res = db.data?.accessTokens.push({
    ...accessToken,
    Id: Math.floor(Math.random() * 10),
  } as QueryAccessToken);
};
export const getAccessToken = async (
  db: DBInstance,
  accessTokenHash: string
): Promise<QueryAccessToken | undefined> => {
  const res = await db.data?.accessTokens.find(
    (a) => a.Token === accessTokenHash
  );
  return res;
};
export const deleteAccessToken = async (
  db: DBInstance,
  accessTokenHash: string
): Promise<boolean> => {
  const accessTokensLengthBefore = db.data?.accessTokens.length;
  const res = await db.data?.accessTokens.filter(
    (a) => a.Token !== accessTokenHash
  );
  db.data = {
    accessTokens: res,
    requests: db.data?.requests,
  } as Data;

  return (res?.length ?? 0) < (accessTokensLengthBefore ?? 0);
};
export const createRequest = async (
  db: DBInstance,
  request: unknown
): Promise<void> => {};
export const getRequestsByToken = async (
  db: DBInstance,
  request: unknown
) => {};
export const updateRequest = async (db: DBInstance, request: unknown) => {};
export const deleteRequest = async (db: DBInstance, request: unknown) => {};
