import type { RequestData, Request } from "./request";

export type Cache = Map<number, Entry>; // id -> Request

export type Entry = Request & {
  resolve: (body: string) => void;
  reject: (error: string) => void;
};

export function init(): Cache {
  return new Map();
}

/**
 * Add request data to cache and return generated id.
 */
export function addData(
  requestCache: Cache,
  reqData: RequestData,
  resolve: (body: string) => void,
  reject: (error: string) => void
): number {
  const id = generateId(requestCache);
  const request = { ...reqData, id, resolve, reject };
  requestCache.set(id, request);
  return id;
}

function generateId(requestCache: Cache) {
  let id = Math.floor(Math.random() * 1e6);
  while (requestCache.has(id)) {
    id = Math.floor(Math.random() * 1e6);
  }
  return id;
}
