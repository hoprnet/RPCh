import * as compatCrypto from '@rpch/compat-crypto';
import * as crypto from 'crypto';

import * as Request from './request';
import * as Response from './response';

export type Cache = Map<string, Entry>; // id -> Request

export type Entry = {
    request: Request.Request;
    resolve: (res: Response.Response) => void;
    reject: (error: Response.SendError) => void;
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
        request: Request.Request;
        resolve: (res: Response.Response) => void;
        reject: (error: Response.SendError) => void;
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
    if (crypto && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return fallbackUUID();
}

/**
 * Fast UUID generator, RFC4122 version 4 compliant.
 * @author Jeff Ward (jcward.com).
 * @license MIT license
 * @link http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136
 **/
const lut: string[] = [];
for (let i = 0; i < 256; i++) {
    lut[i] = (i < 16 ? '0' : '') + i.toString(16);
}
function fallbackUUID() {
    const d0 = (Math.random() * 0xffffffff) | 0;
    const d1 = (Math.random() * 0xffffffff) | 0;
    const d2 = (Math.random() * 0xffffffff) | 0;
    const d3 = (Math.random() * 0xffffffff) | 0;
    return (
        lut[d0 & 0xff] +
        lut[(d0 >> 8) & 0xff] +
        lut[(d0 >> 16) & 0xff] +
        lut[(d0 >> 24) & 0xff] +
        '-' +
        lut[d1 & 0xff] +
        lut[(d1 >> 8) & 0xff] +
        '-' +
        lut[((d1 >> 16) & 0x0f) | 0x40] +
        lut[(d1 >> 24) & 0xff] +
        '-' +
        lut[(d2 & 0x3f) | 0x80] +
        lut[(d2 >> 8) & 0xff] +
        '-' +
        lut[(d2 >> 16) & 0xff] +
        lut[(d2 >> 24) & 0xff] +
        lut[d3 & 0xff] +
        lut[(d3 >> 8) & 0xff] +
        lut[(d3 >> 16) & 0xff] +
        lut[(d3 >> 24) & 0xff]
    );
}
