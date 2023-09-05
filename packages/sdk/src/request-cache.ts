import type { Request } from "./request";
import type { RPCresult, RPCerror } from "./index";

export type Cache = Map<number, Entry>; // id -> Request

export type Entry = Request & {
  started: number;
  resolve: (res: RPCresult | RPCerror) => void;
  reject: (error: string) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function init(): Cache {
  return new Map();
}

/**
 * Add request data to cache and return generated id.
 */
export function add(
  cache: Cache,
  request: Request,
  resolve: (res: RPCresult | RPCerror) => void,
  reject: (error: string) => void,
  timer: ReturnType<typeof setTimeout>
): Entry {
  const entry = {
    ...request,
    started: Date.now(),
    resolve,
    reject,
    timer,
  };
  cache.set(request.id, entry);
  return entry;
}

/**
 * Remove request id from cache.
 */
export function remove(cache: Cache, id: number) {
  const t = cache.get(id)?.timer;
  clearTimeout(t);
  cache.delete(id);
}

/**
 * Generate an available request id.
 * Will loop indefinitely if all request ids are taken (max ~1e7).
 */
export function generateId(cache: Cache): number {
  let id = Math.floor(Math.random() * 1e6);
  while (cache.has(id)) {
    id = Math.floor(Math.random() * 1e6);
  }
  return id;
}
