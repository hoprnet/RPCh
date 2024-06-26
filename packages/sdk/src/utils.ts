import { Utils } from '@hoprnet/uhttp-lib';
import debug from 'debug';

import * as Res from './result';

const textDecoder = new TextDecoder('utf-8');
const textEncoder = new TextEncoder();

export enum VrsnCmp {
    Identical,
    PatchMismatch,
    MinorMismatch,
    MajorMismatch,
}

const DefaultLogLevel = 'info';

export function shortPeerId(peerId: string): string {
    return Utils.shortPeerId(peerId);
}

export function randomEl<T>(arr: T[]): T {
    return arr[randomIdx(arr)];
}

export function randomIdx<T>(arr: T[]): number {
    return Math.floor(Math.random() * arr.length);
}

export function average(arr: number[]): number {
    const sum = arr.reduce((acc, l) => acc + l, 0);
    return sum / arr.length || 0;
}

export const headersToRecord = Utils.headersToRecord.bind(Utils);

export function isValidURL(url: string) {
    if ('canParse' in URL) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return URL.canParse(url);
    }
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        new URL(url);
        return true;
    } catch (_ex) {
        return false;
    }
}

export function bytesToString(arr: Uint8Array) {
    return textDecoder.decode(arr);
}

export function stringToBytes(str: string): Uint8Array {
    return textEncoder.encode(str);
}

export function bytesToBase64(bytes: Uint8Array) {
    const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
    return btoa(binString);
}

export function base64ToBytes(base64: string): Uint8Array {
    const binString = atob(base64);
    return Uint8Array.from(binString, (m) => m.codePointAt(0) as number);
}

export function logger(namespaces: string[]) {
    namespaces.unshift('rpch');
    const ns = namespaces.join(':');
    const verbose = debug(`${ns}:verbose`);
    verbose.log = console.log.bind(console);
    const info = debug(`${ns}:info`);
    info.log = console.info.bind(console);
    const warn = debug(`${ns}:warn`);
    warn.log = console.warn.bind(console);
    const error = debug(`${ns}:error`);
    error.log = console.error.bind(console);

    return {
        error,
        info,
        verbose,
        warn,
    };
}

export function versionCompare(ref: string, version: string): Res.Result<VrsnCmp> {
    const r = ref.split('.');
    if (r.length < 3) {
        return Res.err('invalid ref');
    }
    const v = version.split('.');
    if (v.length < 3) {
        return Res.err('invalid version');
    }
    const [rMj, rMn, rP] = r;
    const [vMj, vMn, vP] = v;
    if (parseInt(rMj, 10) !== parseInt(vMj, 10)) {
        return Res.ok(VrsnCmp.MajorMismatch);
    }
    if (parseInt(rMn, 10) !== parseInt(vMn, 10)) {
        return Res.ok(VrsnCmp.MinorMismatch);
    }
    if (parseInt(rP, 10) !== parseInt(vP, 10)) {
        return Res.ok(VrsnCmp.PatchMismatch);
    }
    return Res.ok(VrsnCmp.Identical);
}

export function setDebugScope(scope: string) {
    debug.enable(scope);
}

export function setDebugScopeLevel(scope?: string, level?: string) {
    const scp = scope ? scope : '*';
    const lvl = debugLevel(level);
    debug.enable([scp, lvl].join(','));
}

function debugLevel(level?: string) {
    const lvl = level ? level : DefaultLogLevel;
    switch (lvl.toLowerCase()) {
        case 'error':
            return '-*:warn,-*:info,-*:verbose';
        case 'warn':
            return '-*:info,-*:verbose';
        case 'info':
            return '-*:verbose';
        case 'verbose':
            return '';
        default:
            return debugLevel(DefaultLogLevel);
    }
}
