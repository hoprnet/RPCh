import * as Res from './result';

export type Parameters = {
    body?: string;
    headers?: Record<string, string>;
    method?: string;
};

export type Response = {
    status: number;
    text: string;
};

export async function fetchURL(
    endpoint: string,
    params?: Parameters,
): Promise<Res.Result<Response>> {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint);
        const headers = determineHeaders(params?.headers);
        const body = params?.body;
        const method = determineMethod(params?.method);
        return fetch(url, { headers, method, body, signal: AbortSignal.timeout(30000) })
            .then(async (res) => {
                const status = res.status;
                const text = await res.text();
                return resolve(Res.ok({ status, text }));
            })
            .catch(reject);
    });
}

function determineHeaders(headers?: Record<string, string>) {
    if (headers) {
        return headers;
    }

    return {
        'Content-Type': 'application/json',
    };
}

function determineMethod(method?: string) {
    const m = method?.toUpperCase().trim();
    if (m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') {
        return m;
    }
    return 'GET';
}
