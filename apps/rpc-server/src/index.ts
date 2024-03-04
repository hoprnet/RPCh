import http from 'http';
import fh from 'node:fs/promises';

import Version from './version';
import RPChSDK, {
    DPapi,
    JRPC,
    ProviderAPI,
    Response,
    Result as Res,
    Utils,
    type RequestOps,
    type Ops as SDKops,
} from '@rpch/sdk';

type ServerOPS = {
    failedRequestsFile?: string;
    restrictCors: boolean;
    skipRPCh: boolean;
    exposeLats: boolean;
};

const log = Utils.logger(['rpc-server']);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    'Access-Control-Max-Age': 2592000,
    'Access-Control-Allow-Headers': '*',
};

const defaultPort = 45750;

function toURL(urlStr: string, host: string): null | URL {
    try {
        return new URL(urlStr, host);
    } catch (_err: any) /* TypeError */ {
        return null;
    }
}

function headersFromStringArray(headersRaw: string[]) {
    return headersRaw.reduce<Record<string, string> | undefined>((acc, h) => {
        const [k, v] = h.split(':');
        if (k && k.trim() && v && v.trim()) {
            if (acc) {
                acc[k] = v.trim();
            } else {
                acc = { [k]: v.trim() };
            }
        }
        return acc;
    }, undefined);
}

function extractParams(urlStr: undefined | string, host: undefined | string): RequestOps {
    if (!urlStr || !host) {
        return {};
    }
    const url = toURL(urlStr, `http://${host}`); // see https://nodejs.org/api/http.html#messageurl
    if (!url) {
        return {};
    }
    const provider = url.searchParams.get('provider');
    const timeout = url.searchParams.get('timeout');
    const measureRPClatency = url.searchParams.get('measureRPClatency');
    const headersRaw = url.searchParams.getAll('h').concat(url.searchParams.getAll('header'));
    const headers = headersFromStringArray(headersRaw);
    return {
        provider: provider ? provider : undefined,
        timeout: timeout ? parseInt(timeout, 10) : undefined,
        measureRPClatency: measureRPClatency
            ? measureRPClatency.toLowerCase() === 'true'
            : undefined,
        headers,
    };
}

function parseBody(
    str: string,
): { success: false; error: string; id?: string } | { success: true; req: JRPC.Request } {
    try {
        const json = JSON.parse(str);
        if (!('jsonrpc' in json)) {
            return {
                success: false,
                error: "'jsonrpc' property missing",
                id: json.id,
            };
        }
        if (!('method' in json)) {
            return {
                success: false,
                error: "'method' property missing",
                id: json.id,
            };
        }
        return { success: true, req: json };
    } catch (err: any) /* SyntaxError */ {
        return { success: false, error: 'invalid JSON' };
    }
}

async function sendSkipRPCh(
    provider: string | undefined,
    req: JRPC.Request,
    res: http.ServerResponse,
) {
    if (!provider) {
        log.error('[NO_RPCH] need provider query param');
        return;
    }
    ProviderAPI.fetchRPC(provider, req)
        .then((resFetch: Res.Result<JRPC.Response, ProviderAPI.RPCFailure>) => {
            if (Res.isErr(resFetch)) {
                const { status, message } = resFetch.error;
                log.info('[NO_RPCH] response[HTTP %d]: %s request[%o]', status, message, req);
                res.statusCode = status;
                // only write if we are allowed to
                if (status !== 204 && status !== 304) {
                    res.write(message);
                }
            } else {
                const resp = resFetch.res;
                log.info('[NO_RPCH] response: %o request[%o]', resp, req);
                res.statusCode = 200;
                res.write(JSON.stringify(resp));
            }
        })
        .catch((err) => {
            log.error('[NO_RPCH] %s request[%o]', err, req);
            res.statusCode = 500;
            res.write(err.toString());
        })
        .finally(() => res.end());
}

async function sendRequest(
    sdk: RPChSDK,
    req: JRPC.Request,
    params: RequestOps,
    res: http.ServerResponse,
    ops: ServerOPS,
) {
    try {
        const resp: Response.Response = await sdk.send(req, params);
        if (resp.status === 200) {
            const json: JRPC.Response = await resp.json();
            if (ops.exposeLats && resp.stats) {
                log.info('response: %o request[%o,%o]', json, req, resp.stats);
                res.statusCode = 200;
                res.write(JSON.stringify({ resp: json, stats: resp.stats }));
            } else {
                log.info('response: %o request[%o]', json, req);
                res.statusCode = 200;
                res.write(JSON.stringify(json));
            }
        } else {
            const text = await resp.text();
            log.info('response[HTTP %d]: %s request[%o]', resp.status, text, req);
            res.statusCode = resp.status;
            // only write if we are allowed to
            if (resp.status !== 204 && resp.status !== 304) {
                res.write(text);
            }
        }
    } catch (err: any) {
        if (err instanceof Response.SendError) {
            const { message, provider, reqHeaders } = err;
            if (ops.failedRequestsFile) {
                const cmdHeaders = Object.entries(reqHeaders)
                    .map(([k, v]) => `-H "${k}: ${v}"`)
                    .join(' ');
                const cmd = `${message} --- curl ${provider} ${cmdHeaders} -d '${JSON.stringify(
                    req,
                )}'`;
                fh.appendFile(ops.failedRequestsFile, cmd + '\n').catch((err) => {
                    log.error(
                        'error appending to FAILED_REQUESTS_FILE[%s]: %s[%o]',
                        ops.failedRequestsFile,
                        JSON.stringify(err),
                        err,
                    );
                });
            }
            log.error('error sending request[%o]: %s', req, message);
            res.statusCode = 500;
            res.write(message);
        } else {
            log.error('error sending request[%o]: %s[%o]', req, JSON.stringify(err), err);
            res.statusCode = 500;
            res.write(err.toString());
        }
    } finally {
        res.end();
    }
}

function createServer(sdk: RPChSDK, ops: ServerOPS) {
    return http.createServer((req, res) => {
        req.on('error', (err) => {
            log.error('error on http.Request: %s[%o]', JSON.stringify(err), err);
        });

        res.on('error', (err) => {
            log.error('error on http.Response: %s[%o]', JSON.stringify(err), err);
        });

        if (!ops.restrictCors) {
            // handle preflight cors
            if (req.method === 'OPTIONS') {
                res.writeHead(204, corsHeaders);
                res.end();
                return;
            }

            // handle cors
            if (req.method === 'POST' || req.method === 'GET') {
                Object.entries(corsHeaders).map(([k, v]) => {
                    res.setHeader(k, v);
                });
            }
        }

        let body = '';
        req.on('data', (data) => {
            body += data;
        });

        req.on('end', () => {
            const params = extractParams(req.url, req.headers.host);
            const result = parseBody(body);
            if (result.success) {
                if (ops.skipRPCh) {
                    log.info('[NO_RPCH] sending request[%o] with params[%o]', result.req, params);
                    sendSkipRPCh(params.provider, result.req, res);
                } else {
                    log.info('sending request[%o] with params[%o]', result.req, params);
                    sendRequest(sdk, result.req, params, res, ops);
                }
            } else {
                log.error('error parsing body: %s - during request: %s', result.error, body);
                res.statusCode = 500;
                res.write(
                    JSON.stringify({
                        jsonrpc: '2.0',
                        error: { code: -32700, message: `Parse error: ${result.error}` },
                        id: result.id,
                    }),
                );
                res.end();
            }
        });
    });
}

function determinePort(portEnv?: string) {
    if (portEnv) {
        const p = parseInt(portEnv, 10);
        if (p) {
            return p;
        }
    }
    return defaultPort;
}

function versionListener({ rpcServer }: DPapi.Versions) {
    const cmp = Utils.versionCompare(rpcServer, Version);
    if (Res.isErr(cmp)) {
        log.error('error comparing versions: %s', cmp.error);
        return;
    }
    const logErr = () => {
        const errMessage = [
            `*** RPCServer[v${Version}] outdated and will not work -`,
            `please update to latest version v${rpcServer}.`,
            'Visit https://degen.rpch.net for detail! ***',
        ].join(' ');
        const errDeco = Array.from({ length: errMessage.length }, () => '*').join('');
        log.error('');
        log.error(`!!! ${errDeco} !!!`);
        log.error(`!!! ${errMessage} !!!`);
        log.error(`!!! ${errDeco} !!!`);
        log.error('');
    };
    switch (cmp.res) {
        case Utils.VrsnCmp.Identical:
            log.verbose('version check successful - RPCServer[v%s] is up to date', Version);
            break;
        case Utils.VrsnCmp.PatchMismatch:
            log.info(
                [
                    'Newer version available -',
                    'RPCServer[v%s] can be updated to v%s.',
                    'Please visit https://degen.rpch.net to get the latest version!',
                ].join(' '),
                Version,
                rpcServer,
            );
            break;
        case Utils.VrsnCmp.MinorMismatch:
            // treat as major mismatch as long as still v0.x.x
            if (Version.startsWith('0.')) {
                logErr();
            } else {
                log.warn(
                    [
                        'Severely outdated - RPCServer[v%s] needs to update to v%s.',
                        'Please visit https://degen.rpch.net to get the latest version!',
                    ].join(' '),
                    Version,
                    rpcServer,
                );
            }
            break;
        case Utils.VrsnCmp.MajorMismatch:
            logErr();
            break;
    }
}

function parseBooleanEnv(env?: string) {
    if (env) {
        if ('0' === env.toLowerCase()) {
            return false;
        }
        if ('no' === env.toLowerCase()) {
            return false;
        }
        return env.toLowerCase() !== 'false';
    }
    return false;
}

/**
 * RPC server - uses RPChSDK to perform JSON-RPC requests.
 *
 * ENV vars for this RPC server:
 *
 * RESTRICT_CORS - do not allow requests from everywhere
 * SKIP_RPCH - just relay requests directly, do not use RPCh
 * FAILED_REQUESTS_FILE - log failed requests to this file
 * RPCH_LATENCY_STATS - request detailed latencies, needs verbose logging to be visible
 * RPCH_EXPOSE_LATENCY_STATS - request detailed latencies and modify the return parameter to include those
 * PORT - default port to run on, optional
 * HEADER_<string> - provide default headers for every request
 * Specify multiple headers by using different strings after `_`. Typically used for authentication headers.
 * The formatting is expected in typical header formatting: `e.g.: HEADER_AUTH=x-apikey:foobarbarfoo`
 *
 * ENV vars for RPCh SDK:
 *
 * See **RPChSDK.Ops** for documentation on those.
 *
 * CLIENT - cliendId your unique string used to identify how many requests your client/wallet pushes through the network
 * DISCOVERY_PLATFORM_API_ENDPOINT - Ops.discoveryPlatformEndpoint
 * RESPONSE_TIMEOUT - Ops.timeout
 * PROVIDER - Ops.provider
 * DISABLE_MEV_PROTECTION - Ops.disableMevProtection
 * MEV_PROTECTION_PROVIDER - Ops.mevProtectionProvider
 * MEV_KICKBACK_ADDRESS - Ops.mevKickbackAddress
 * FORCE_ZERO_HOP - Ops.forceZeroHop
 * FORCE_MANUAL_RELAYING - Ops.forceManualRelaying
 * SEGMENT_LIMIT - Ops.segmentLimit
 * RPCH_LOG_LEVEL - Ops.logLevel
 *
 * See **RPChSDK.RequestOps** for overridable per request parameters.
 */
if (require.main === module) {
    if (!process.env.CLIENT) {
        throw new Error("Missing 'CLIENT' env var.");
    }
    const clientId = process.env.CLIENT;
    const addLats = parseBooleanEnv(process.env.RPCH_LATENCY_STATS);
    const exposeLats = parseBooleanEnv(process.env.RPCH_EXPOSE_LATENCY_STATS);
    const headersRaw = Object.entries(process.env).reduce<string[]>((acc, [k, v]) => {
        if (k && k.startsWith('HEADER_') && v) {
            acc.push(v);
        }
        return acc;
    }, []);
    const headers = headersFromStringArray(headersRaw);

    const ops: SDKops = {
        discoveryPlatformEndpoint: process.env.DISCOVERY_PLATFORM_API_ENDPOINT,
        timeout: process.env.RESPONSE_TIMEOUT
            ? parseInt(process.env.RESPONSE_TIMEOUT, 10)
            : undefined,
        provider: process.env.PROVIDER,
        disableMevProtection: parseBooleanEnv(process.env.DISABLE_MEV_PROTECTION),
        mevProtectionProvider: process.env.MEV_PROTECTION_PROVIDER,
        mevKickbackAddress: process.env.MEV_KICKBACK_ADDRESS,
        forceZeroHop: parseBooleanEnv(process.env.FORCE_ZERO_HOP),
        forceManualRelaying: parseBooleanEnv(process.env.FORCE_MANUAL_RELAYING),
        segmentLimit: process.env.SEGMENT_LIMIT
            ? parseInt(process.env.SEGMENT_LIMIT, 10)
            : undefined,
        logLevel: process.env.RPCH_LOG_LEVEL,
        measureRPClatency: exposeLats || addLats,
        headers,
        versionListener,
    };

    const serverOps = {
        restrictCors: !!process.env.RESTRICT_CORS,
        skipRPCh: !!process.env.SKIP_RPCH,
        failedRequestsFile: process.env.FAILED_REQUESTS_FILE,
        exposeLats,
    };
    const port = determinePort(process.env.PORT);

    const sdk = new RPChSDK(clientId, ops);
    const server = createServer(sdk, serverOps);
    server.listen(port, '0.0.0.0', () => {
        log.info(
            "RPCServer[v%s] started on '0.0.0.0:%d' with %s and SDKops[%s]",
            Version,
            port,
            JSON.stringify(serverOps),
            JSON.stringify(ops),
        );
    });
}
