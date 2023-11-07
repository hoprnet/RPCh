import * as compatCrypto from '@rpch/compat-crypto';
import * as crypto from 'crypto';
import type { Request } from './request';
import type { Response } from './response';

export type Cache = Map<string, Entry>; // id -> Request

export type Entry = {
    request: Request;
    resolve: (res: Response) => void;
    reject: (error: string) => void;
    session: compatCrypto.Session;
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
    {
        request,
        resolve,
        reject,
        session,
        timer,
    }: {
        request: Request;
        resolve: (res: Response) => void;
        reject: (error: string) => void;
        session: compatCrypto.Session;
        timer: ReturnType<typeof setTimeout>;
    },
): Entry {
    const entry = {
        request,
        resolve,
        reject,
        session,
        timer,
    };
    cache.set(request.id, entry);
    return entry;
}

/**
 * Remove request id from cache.
 */
export function remove(cache: Cache, id: string) {
    const t = cache.get(id)?.timer;
    clearTimeout(t);
    cache.delete(id);
}

/**
 * Generate a sufficiently unique request id.
 */
export function generateId(_cache: Cache): string {
    return crypto.randomUUID();
}
