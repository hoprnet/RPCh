import debug from 'debug';

export function shortPeerId(peerId: string): string {
    return `.${peerId.substring(peerId.length - 4)}`;
}

export function randomEl<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
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

export function logger(namespaces: string[]) {
    namespaces.unshift('rpch');
    const base = debug(namespaces.join(':'));
    base.log = console.log.bind(console);

    const verbose = base.extend('verbose');
    const error = base.extend('error');

    return {
        error,
        info: base,
        verbose,
    };
}
