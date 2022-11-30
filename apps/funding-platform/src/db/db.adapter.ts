import { CreateAccessToken, QueryAccessToken } from "../access-token";
import { Low } from "lowdb";

export const saveAccessToken = (
  db: Low<null>,
  accessToken: CreateAccessToken
) => {
  // db logic to save access token
};
export const getAccessToken = (db: Low<null>, accessToken: string) => {
  return "" as unknown as QueryAccessToken;
};
export const deleteAccessToken = (db: Low<null>, accessToken: string) => {};
export const createRequest = (db: Low<null>, request: unknown) => {};
export const getRequestsByToken = (db: Low<null>, request: unknown) => {};
export const updateRequest = (db: Low<null>, request: unknown) => {};
export const deleteRequest = (db: Low<null>, request: unknown) => {};
