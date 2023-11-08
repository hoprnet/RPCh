import http from 'http';
import RPChSDK, {
    JRPC,
    ProviderAPI,
    Response,
    Result as Res,
    Utils,
    type RequestOps,
    type Ops as SDKops,
} from '@rpch/sdk';

type ServerOPS = { restrictCors: boolean; skipRPCh: boolean };

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
    return {
        provider: provider ? provider : undefined,
        timeout: timeout ? parseInt(timeout, 10) : undefined,
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

function sendSkipRPCh(provider: string | undefined, req: JRPC.Request, res: http.ServerResponse) {
    if (!provider) {
        log.error('[NO_RPCH] Need provider query param');
        return;
    }
    ProviderAPI.fetchRPC(provider, req)
        .then((resFetch: Res.Result<JRPC.Response, ProviderAPI.RPCFailure>) => {
            if (Res.isErr(resFetch)) {
                const { status, message } = resFetch.error;
                log.verbose(
                    '[NO_RPCH] Response(HTTP %i): %s [request: %s]',
                    status,
                    message,
                    JSON.stringify(req),
                );
                res.statusCode = status;
                // only write if we are allowed to
                if (status !== 204 && status !== 304) {
                    res.write(message);
                }
            } else {
                const resp = resFetch.res;
                log.verbose(
                    '[NO_RPCH] Response: %s [request: %s]',
                    JSON.stringify(resp),
                    JSON.stringify(req),
                );
                res.statusCode = 200;
                res.write(JSON.stringify(resp));
            }
        })
        .catch((err) => {
            log.error('[NO_RPCH] %s [request: %s]', err, JSON.stringify(req));
            res.statusCode = 500;
            res.write(err);
        })
        .finally(() => res.end());
}

function sendRequest(
    sdk: RPChSDK,
    req: JRPC.Request,
    params: RequestOps,
    res: http.ServerResponse,
) {
    sdk.send(req, params)
        .then(async (resp: Response.Response) => {
            if (resp.status === 200) {
                return resp.json();
            }
            const text = await resp.text();
            log.verbose(
                'Response(HTTP %i): %s [request: %s]',
                resp.status,
                text,
                JSON.stringify(req),
            );
            res.statusCode = resp.status;
            // only write if we are allowed to
            if (resp.status !== 204 && resp.status !== 304) {
                res.write(text);
            }
        })
        .then((resp?: JRPC.Response) => {
            log.verbose('Response: %s [request: %s]', JSON.stringify(resp), JSON.stringify(req));
            res.statusCode = 200;
            res.write(JSON.stringify(resp));
        })
        .catch((err: any) => {
            log.error('%s [request: %s]', err, JSON.stringify(req));
            res.statusCode = 500;
            res.write(err);
        })
        .finally(() => {
            res.end();
        });
}

function createServer(sdk: RPChSDK, ops: ServerOPS) {
    return http.createServer((req, res) => {
        req.on('error', (err) => {
            log.error('Unexpected error occured on http.Request', err);
        });

        res.on('error', (err) => {
            log.error('Unexpected error occured on http.Response', err);
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
                    log.info(
                        '[NO_RPCH] Sending request',
                        JSON.stringify(result.req),
                        'with params',
                        JSON.stringify(params),
                    );
                    sendSkipRPCh(params.provider, result.req, res);
                } else {
                    log.info(
                        'Sending request',
                        JSON.stringify(result.req),
                        'with params',
                        JSON.stringify(params),
                    );
                    sendRequest(sdk, result.req, params, res);
                }
            } else {
                log.info('Parse error:', result.error, '- during request:', body);
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

/**
 * RPC server - uses RPChSDK to perform JSON-RPC requests.
 *
 * Reads ENV vars:
 *
 * PORT - default port to run on, optional
 * RESTRICT_CORS - do not allow requests from everywhere
 *
 * CLIENT - client id, identifier of your wallet/application, required
 * RESPONSE_TIMEOUT - default request-response timeout, optional, can be overridden per request
 * PROVIDER - default rpc provider endpoint, optional, can be overridden per request
 * DISABLE_MEV_PROTECTION - disable special handling of transaction request on mainnet
 * MEV_PROTECTION_PROVIDER - transaction rpc provider endpoint
 * MEV_KICKBACK_ADDRESS - revenue share address when using mev protection provider
 *
 * See **RPChSDK.RequestOps** for overridable per request parameters.
 */
if (require.main === module) {
    if (!process.env.CLIENT) {
        throw new Error("Missing 'CLIENT' env var.");
    }

    const clientId = process.env.CLIENT;
    const ops: SDKops = {
        discoveryPlatformEndpoint: process.env.DISCOVERY_PLATFORM_API_ENDPOINT,
        timeout: process.env.RESPONSE_TIMEOUT
            ? parseInt(process.env.RESPONSE_TIMEOUT, 10)
            : undefined,
        provider: process.env.PROVIDER,
        disableMevProtection: new Boolean(process.env.DISABLE_MEV_PROTECTION).valueOf(),
        mevProtectionProvider: process.env.MEV_PROTECTION_PROVIDER,
        mevKickbackAddress: process.env.MEV_KICKBACK_ADDRESS,
        forceZeroHop: !!process.env.FORCE_ZERO_HOP,
        segmentLimit: process.env.SEGMENT_LIMIT
            ? parseInt(process.env.SEGMENT_LIMIT, 10)
            : undefined,
    };

    const serverOps = {
        restrictCors: !!process.env.RESTRICT_CORS,
        skipRPCh: !!process.env.SKIP_RPCH,
    };
    const port = determinePort(process.env.PORT);

    const sdk = new RPChSDK(clientId, ops);
    const server = createServer(sdk, serverOps);
    server.listen(port, '0.0.0.0', () => {
        log.verbose(`rpc server started on '0.0.0.0:${port}' with ${JSON.stringify(ops)}`);
    });
}
