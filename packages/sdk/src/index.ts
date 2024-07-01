import { Routing } from '@hoprnet/uhttp-lib';
import * as DPapi from './dp-api';
import * as JRPC from './jrpc';
import * as Res from './result';
import * as Response from './response';
import * as Utils from './utils';
import Version from './version';

export * as DPapi from './dp-api';
export * as EntryNode from './entry-node';
export * as ExitNode from './exit-node';
export * as JRPC from './jrpc';
export * as NodeAPI from './node-api';
export * as Payload from './payload';
export * as ProviderAPI from './provider-api';
export * as Request from './request';
export * as Response from './response';
export * as Result from './result';
export * as Segment from './segment';
export * as SegmentCache from './segment-cache';
export * as Utils from './utils';

/**
 * HOPR SDK options provides global parameter values.
 * Two of them can be overridden on a per request base.
 * None of the parameters need to be set as the SDK provides defaults for all of them.
 * See **RequestOps** for specifics.
 * See **defaultOps** for defaults.
 *
 * @param discoveryPlatformEndpoint discovery platform API endpoint
 * @param timeout - timeout for receiving responses
 * @param provider - target rpc provider
 * @param disableMevProtection - disable provider replacement on transaction requests
 * @param mevProtectionProvider - target MEV Protection provider RPC,
 *                                will send transactions through this provider
 * @param mevKickbackAddress - provide this URL for receiving kickback share to a different address than the tx origin
 * @param forceZeroHop - disable routing protection
 * @param segmentLimit - limit the number of segment a request can use, fails requests that require a larger number
 * @param versionListener - if you need to know what the current versions of RPCh related components are
 * @param debugScope - programatically set debug scope for SDK
 * @param logLevel - only print log statements that match at least the desired level: verbose < info < warn < error
 * @param forceManualRelaying - determine relay nodes for requests/responses and enforce them for one hop messages, can not be used with zero hop
 * @param measureRPClatency - determine duration of actual RPC request from exit node, populates response stats
 * @param headers - provide additional headers used for requests, e.g. authentication headers
 */
export type Ops = {
    readonly discoveryPlatformEndpoint?: string;
    readonly timeout?: number;
    readonly provider?: string;
    readonly disableMevProtection?: boolean;
    readonly mevProtectionProvider?: string;
    readonly mevKickbackAddress?: string;
    readonly forceZeroHop?: boolean;
    readonly segmentLimit?: number;
    readonly versionListener?: (versions: DPapi.Versions) => void;
    readonly debugScope?: string;
    readonly logLevel?: string; // 'verbose' | 'info' | 'warn' | 'error'
    readonly forceManualRelaying?: boolean;
    readonly measureRPClatency?: boolean;
    readonly headers?: Record<string, string>;
};

/**
 * Overridable parameters per request.
 * See **Ops** for other params details
 * @param headers - will be merged with provided headers during construction
 */
export type RequestOps = {
    readonly headers?: Record<string, string>;
    readonly provider?: string;
    readonly timeout?: number;
};

const RPC_PROPELLORHEADS = 'https://rpc.propellerheads.xyz/eth';

/**
 * Global defaults.
 * See **Ops** for details.
 **/
const defaultOps = {
    discoveryPlatformEndpoint: 'https://discovery.rpch.tech',
    timeout: 10e3,
    provider: 'https://gnosis.rpc-provider.prod.hoprnet.link',
    disableMevProtection: false,
    mevProtectionProvider: RPC_PROPELLORHEADS,
    forceZeroHop: false,
    forceManualRelaying: false,
    logLevel: 'info',
    measureRPClatency: false,
};

const log = Utils.logger(['sdk']);

/**
 * Send traffic through the RPCh network
 */
export default class SDK {
    private readonly uClient: Routing.Client;
    private readonly ops;
    private readonly chainIds: Map<string, string> = new Map();

    /**
     * Construct an SDK instance enabling RPCh requests.
     * @param cliendId your unique string used to identify how many requests your client/wallet pushes through the network
     * @param crypto crypto instantiation for RPCh, use `@rpch/crypto-for-nodejs` or `@rpch/crypto-for-web`
     * @param ops, see **Ops**
     **/
    constructor(
        private readonly clientId: string,
        ops: Ops = {},
    ) {
        this.ops = this.sdkOps(ops);
        (this.ops.debugScope || this.ops.logLevel) &&
            Utils.setDebugScopeLevel(this.ops.debugScope, this.ops.logLevel);
        this.uClient = new Routing.Client(this.clientId, {
            ...this.ops,
            measureLatency: this.ops.measureRPClatency,
        });
        this.fetchVersions();
        this.fetchChainId(this.ops.provider as string, this.ops.headers);
        log.info('RPCh SDK[v%s] started', Version);
    }

    /**
     * Stop listeners and free acquired resources.
     */
    public destruct = () => {
        this.uClient.destruct();
    };

    /**
     * Resolves true when node pairs are awailable.
     * If no timeout specified, global timeout is used.
     */
    public isReady = async (timeout?: number): Promise<boolean> => {
        return this.uClient.isReady(timeout);
    };

    /**
     * Send an **RPCrequest** via RPCh.
     * See **RequestOps** for overridable options.
     * Returns a **Response.SendError** on error.
     */
    public send = async (req: JRPC.Request, ops?: RequestOps): Promise<Response.Response> => {
        this.populateChainIds(ops?.provider, ops?.headers);
        return this.doSend(req, ops);
    };

    private doSend = async (req: JRPC.Request, ops?: RequestOps): Promise<Response.Response> => {
        const provider = this.determineProvider(req, ops?.provider);
        const timeout = ops?.timeout ?? this.ops.timeout;
        const headers = this.determineHeaders(provider, this.ops.mevKickbackAddress, ops?.headers);

        // sanity check provider url
        if (!Utils.isValidURL(provider)) {
            throw new Response.SendError('Cannot parse provider URL', provider, headers);
        }
        // sanity check mev protection provider url, if it is set
        if (this.ops.mevProtectionProvider) {
            if (!Utils.isValidURL(this.ops.mevProtectionProvider)) {
                throw new Response.SendError(
                    'Cannot parse mevProtectionProvider URL',
                    provider,
                    headers,
                );
            }
        }

        // provide chainId
        this.uClient.onRequestCreationHandler = (r) => {
            r.chainId = this.chainIds.get(provider);
            return r;
        };

        try {
            const res = await this.uClient.fetch(provider, {
                headers,
                body: JSON.stringify(req),
                timeout,
                method: 'POST',
            });
            const text = await res.text();
            return {
                status: res.status,
                statusText: res.statusText,
                text,
                headers: Utils.headersToRecord(res.headers),
            };
        } catch (err: any) {
            const msg = err.toString();
            if (msg.includes('no nodes matching required version')) {
                log.info('Error fetching version compatible routes - triggering version check.');
                this.fetchVersions();
            }
            throw new Response.SendError(`Error making request: ${err}`, provider, headers);
        }
    };

    private sdkOps = (ops: Ops) => {
        const discoveryPlatformEndpoint =
            ops.discoveryPlatformEndpoint || defaultOps.discoveryPlatformEndpoint;
        const forceZeroHop = ops.forceZeroHop ?? defaultOps.forceZeroHop;
        const forceManualRelaying = forceZeroHop
            ? false
            : ops.forceManualRelaying ?? defaultOps.forceManualRelaying;
        const measureRPClatency = ops.measureRPClatency ?? defaultOps.measureRPClatency;
        return {
            discoveryPlatformEndpoint,
            timeout: ops.timeout || defaultOps.timeout,
            provider: ops.provider || defaultOps.provider,
            disableMevProtection: ops.disableMevProtection ?? defaultOps.disableMevProtection,
            mevProtectionProvider: ops.mevProtectionProvider || defaultOps.mevProtectionProvider,
            mevKickbackAddress: ops.mevKickbackAddress,
            forceZeroHop,
            versionListener: ops.versionListener,
            debugScope: ops.debugScope,
            logLevel: ops.logLevel || (process.env.DEBUG ? undefined : defaultOps.logLevel),
            forceManualRelaying,
            measureRPClatency,
            headers: ops.headers,
        };
    };

    private fetchVersions = async () => {
        try {
            const versions = await DPapi.fetchVersions({
                discoveryPlatformEndpoint: this.ops.discoveryPlatformEndpoint,
                clientId: this.clientId,
            });
            setTimeout(() => this.onVersions(versions));
        } catch (err) {
            log.error('Error fetching versions from DiscoveryPlatform: %o', err);
        }
    };

    private fetchChainId = async (
        provider: string,
        headers?: Record<string, string>,
        starknet?: boolean,
    ) => {
        const req = JRPC.chainId(provider, starknet);

        // fetch request through RPCh
        const res = await this.doSend(req, { provider, headers }).catch((err) =>
            log.warn('error fetching chainId for %s: %s[%o]', provider, JSON.stringify(err), err),
        );
        if (!res) {
            return;
        }

        // check HTTP response status and determine error
        if (res.status !== 200) {
            try {
                log.warn(
                    'unable to resolve chainId for %s: %d[%s] %s',
                    provider,
                    res.status,
                    res.statusText,
                    res.text,
                );
            } catch (err) {
                log.error(
                    'unable to determine error message for failed chainId call to %s: %s[%o]',
                    provider,
                    JSON.stringify(err),
                    err,
                );
            }
            return;
        }

        // check JRPC payload and determine error
        try {
            const jrpc = JSON.parse(res.text);
            if (JRPC.isError(jrpc)) {
                if (
                    jrpc.error.code === -32601 ||
                    jrpc.error.message.toLowerCase().includes('method not found')
                ) {
                    // try chainId on starknet
                    if (!starknet) {
                        this.fetchChainId(provider, headers, true);
                    }
                } else {
                    log.warn(
                        'jrpc error response for chainId request to %s: %s',
                        provider,
                        JSON.stringify(jrpc.error),
                    );
                }
            } else {
                log.info('determined chain id %s for %s', jrpc.result, provider);
                this.chainIds.set(provider, jrpc.result);
            }
        } catch (err) {
            log.error(
                'unable to resolve json response for chainId call to %s, %s[%o]',
                provider,
                JSON.stringify(err),
                err,
            );
        }
    };

    private determineProvider = ({ method }: JRPC.Request, provider?: string): string => {
        const prov = provider ?? this.ops.provider ?? defaultOps.provider;
        if (this.ops.disableMevProtection) {
            return prov;
        }
        if (method !== 'eth_sendRawTransaction') {
            return prov;
        }
        // sanity check for chain id if we got it
        const cId = this.chainIds.get(prov);
        if (cId === '0x1' || (cId && parseInt(cId) === 1)) {
            return this.ops.mevProtectionProvider;
        }
        return prov;
    };

    private determineHeaders = (
        provider: string,
        mevKickbackAddress?: string,
        headers?: Record<string, string>,
    ) => {
        // if we provide headers we need to provide all of them
        if (provider === RPC_PROPELLORHEADS && mevKickbackAddress) {
            return {
                'X-Tx-Origin': mevKickbackAddress,
                'Content-Type': 'application/json',
                ...this.ops.headers,
                ...headers,
            };
        }
        // merge headers with provided headers
        if (headers || this.ops.headers) {
            return {
                'Content-Type': 'application/json',
                ...this.ops.headers,
                ...headers,
            };
        }
        // default to application/json content type if no headers are provide
        return { 'Content-Type': 'application/json' };
    };

    private populateChainIds = (provider?: string, opsHeaders?: Record<string, string>) => {
        if (!provider) {
            return;
        }
        if (this.chainIds.has(provider)) {
            return;
        }
        const headers = this.determineHeaders(provider, undefined, opsHeaders);
        this.fetchChainId(provider, headers);
    };

    private onVersions = (versions: DPapi.Versions) => {
        const vSdk = versions.sdk;
        const cmp = Utils.versionCompare(vSdk, Version);
        if (Res.isOk(cmp)) {
            switch (cmp.res) {
                case Utils.VrsnCmp.Identical:
                    log.info('RPCh SDK[v%s] is up to date', Version);
                    break;
                case Utils.VrsnCmp.PatchMismatch:
                    log.info('RPCh SDK[v%s] can be updated to v%s.', Version, vSdk);
                    break;
                case Utils.VrsnCmp.MinorMismatch:
                    log.warn('RPCh SDK[v%s] needs to update to v%s.', Version, vSdk);
                    break;
                case Utils.VrsnCmp.MajorMismatch:
                    log.error('RPCh SDK[v%s] must be updated to v%s!', Version, vSdk);
                    break;
            }
        } else {
            log.error('error comparing versions: %s', cmp.error);
        }

        setTimeout(() => {
            try {
                this.ops.versionListener && this.ops.versionListener(versions);
            } catch (err) {
                log.warn("'versionListener' throws error: %o", err);
            }
        });
    };
}
