import debug from 'debug';
import * as Res from './result';

export enum VrsnCmp {
    Identical,
    PatchMismatch,
    MinorMismatch,
    MajorMismatch,
}

const DefaultLogLevel = 'info';

export function shortPeerId(peerId: string): string {
    return `.${peerId.substring(peerId.length - 4)}`;
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

export function hexStringToUint8Array(hexString: string) {
    // Remove the '0x' prefix if it exists
    hexString = hexString.startsWith('0x') ? hexString.slice(2) : hexString;

    // Check if the hex string has an odd length, and pad with a leading zero if needed
    if (hexString.length % 2 !== 0) {
        hexString = '0' + hexString;
    }

    // Create a Uint8Array by iterating through the hex string
    const uint8Array = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        uint8Array[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }

    return uint8Array;
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
