import * as JRPC from './jrpc';
import * as Res from './result';

export type RPCFailure = { status: number; message: string };

export function fetchRPC(
    provider: string,
    req: JRPC.Request,
    reqHeaders?: Record<string, string>
): Promise<Res.Result<JRPC.Response, RPCFailure>> {
    return new Promise((resolve, reject) => {
        const url = new URL(provider);
        const headers = mergeHeaders(reqHeaders);
        const body = JSON.stringify(req);
        fetch(url, { headers, method: 'POST', body })
            .then(async (res) => {
                if (res.status !== 200) {
                    return resolve(Res.err({ status: res.status, message: await res.text() }));
                }
                const resp = (await res.json()) as unknown as JRPC.Response;
                return resolve(Res.ok(resp));
            })
            .catch(reject);
    });
}

function mergeHeaders(headers?: Record<string, string>) {
    return {
        ...headers,
        'Content-Type': 'application/json',
    };
}
