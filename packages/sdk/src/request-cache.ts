import type { RequestData, Request } from "./request";

export type Cache = Map<number, Request>; // id -> Request

export function init(): Cache {
  return new Map();
}

/**
 * Add request to cache and return generated id.
 */
export function addRequest(
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
