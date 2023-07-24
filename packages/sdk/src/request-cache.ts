import type { PartialRequest, Request } from "./request";

export type Cache = Map<number, Request>; // id -> Request

/**
 * Add request to cache and return generated id.
 */
export function addRequest(requestCache: Cache, pReq: PartialRequest): number {
  const id = generateId(requestCache);
  const request = { ...pReq, id };
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
