import { utils as etherUtils } from 'ethers';

import * as DPapi from './dp-api';
import * as JRPC from './jrpc';
import * as NodeAPI from './node-api';
import * as Payload from './payload';
import * as Request from './request';
import * as RequestCache from './request-cache';
import * as Res from './result';
import * as Response from './response';
import * as Segment from './segment';
import * as SegmentCache from './segment-cache';
import * as Utils from './utils';
import NodesCollector from './nodes-collector';
import Version from './version';
import type { EntryNode } from './entry-node';

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
};

/**
 * Overridable parameters per request.
 * @param headers - provider additional headers used for the request
 * See **Ops** for other params details
 */
export type RequestOps = {
    readonly timeout?: number;
    readonly provider?: string;
    readonly measureRPClatency?: boolean;
    readonly headers?: Record<string, string>;
};

const RPC_PROPELLORHEADS = 'https://rpc.propellerheads.xyz/eth';

/**
 * Global defaults.
 * See **Ops** for details.
 **/
const defaultOps = {
    discoveryPlatformEndpoint: 'https://discovery.rpch.tech',
    timeout: 10e3,
    provider: 'https://gnosis-provider.rpch.tech',
    disableMevProtection: false,
    mevProtectionProvider: RPC_PROPELLORHEADS,
    forceZeroHop: false,
    segmentLimit: 0, // disable segment limit
    forceManualRelaying: false,
    logLevel: 'info',
    measureRPClatency: false,
};

const log = Utils.logger(['sdk']);

// message tag - more like port since we tag all our messages the same
// 0xffff reserved for Availability Monitor
const ApplicationTag = Math.floor(Math.random() * 0xfffe);

/**
 * Send traffic through the RPCh network
 */
export default class SDK {
    private readonly requestCache: RequestCache.Cache;
    private readonly segmentCache: SegmentCache.Cache;
    private readonly redoRequests: Set<string> = new Set();
    private readonly nodesColl: NodesCollector;
    private readonly ops;
    private readonly chainIds: Map<string, number> = new Map();
    private readonly hops?: number;

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
        this.requestCache = RequestCache.init();
        this.segmentCache = SegmentCache.init();
        this.hops = this.determineHops(!!this.ops.forceZeroHop);
        this.nodesColl = new NodesCollector(
            this.ops.discoveryPlatformEndpoint,
            this.clientId,
            ApplicationTag,
            this.onMessages,
            this.onVersions,
            this.hops,
            this.ops.forceManualRelaying,
        );
        this.fetchChainId(this.ops.provider as string);
        log.info('RPCh SDK[v%s] started', Version);
    }

    /**
     * Stop listeners and free acquired resources.
     */
    public destruct = () => {
        this.nodesColl.destruct();
        for (const [rId] of this.requestCache) {
            RequestCache.remove(this.requestCache, rId);
            SegmentCache.remove(this.segmentCache, rId);
        }
    };

    /**
     * Resolves true when node pairs are awailable.
     * If no timeout specified, global timeout is used.
     */
    public isReady = async (timeout?: number): Promise<boolean> => {
        const t = timeout || this.ops.timeout;
        return this.nodesColl.ready(t).then((_) => true);
    };

    /**
     * Send an **RPCrequest** via RPCh.
     * See **RequestOps** for overridable options.
     */
    public send = async (req: JRPC.Request, ops?: RequestOps): Promise<Response.Response> => {
        this.populateChainIds(ops?.provider);
        return this.doSend(req, ops);
    };

    private doSend = async (req: JRPC.Request, ops?: RequestOps): Promise<Response.Response> => {
        const reqOps = this.requestOps(ops);
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            // sanity check provider url
            if (!Utils.isValidURL(reqOps.provider)) {
                return reject('Cannot parse provider URL');
            }
            // sanity check mev protection provider url, if it is set
            if (this.ops.mevProtectionProvider) {
                if (!Utils.isValidURL(this.ops.mevProtectionProvider)) {
                    return reject('Cannot parse mevProtectionProvider URL');
                }
            }

            // gather entry - exit node pair
            const resNodes = await this.nodesColl.requestNodePair(reqOps.timeout).catch((err) => {
                log.error('Error finding node pair', err);
                return reject(`Could not find node pair in ${reqOps.timeout} ms`);
            });
            if (!resNodes) {
                return reject('Unexpected code flow - should never be here');
            }

            const provider = this.determineProvider(reqOps, req);
            const headers = this.determineHeaders(
                provider,
                this.ops.mevKickbackAddress,
                ops?.headers,
            );

            // create request
            const { entryNode, exitNode, counterOffset } = resNodes;
            const { reqRelayPeerId, respRelayPeerId } = this.ops.forceManualRelaying
                ? resNodes
                : { reqRelayPeerId: undefined, respRelayPeerId: undefined };
            const id = RequestCache.generateId(this.requestCache);
            const resReq = Request.create({
                id,
                provider,
                req,
                clientId: this.clientId,
                entryPeerId: entryNode.id,
                exitPeerId: exitNode.id,
                exitPublicKey: etherUtils.arrayify(exitNode.pubKey),
                counterOffset,
                measureRPClatency: reqOps.measureRPClatency,
                headers,
                hops: this.hops,
                reqRelayPeerId,
                respRelayPeerId,
            });

            if (Res.isErr(resReq)) {
                log.error('error creating request', resReq.error);
                return reject('Unable to create request object');
            }

            // split request to segments
            const { request, session } = resReq.res;
            const segments = Request.toSegments(request, session);
            const failMsg = this.checkSegmentLimit(segments.length);
            if (failMsg) {
                return reject(failMsg);
            }

            // set request expiration timer
            const timer = setTimeout(() => {
                log.error(
                    '%s expired after %dms timeout',
                    Request.prettyPrint(request),
                    reqOps.timeout,
                );
                this.removeRequest(request);
                return reject('Request timed out');
            }, reqOps.timeout);

            // track request
            const entry = RequestCache.add(this.requestCache, {
                request,
                resolve,
                reject,
                timer,
                session,
            });
            this.nodesColl.requestStarted(request);

            // send request to hoprd
            log.info('sending request %s', Request.prettyPrint(request));

            // queue segment sending for all of them
            segments.forEach((s) => {
                this.nodesColl.segmentStarted(request, s);
                this.sendSegment(request, s, entryNode, entry);
            });
        });
    };

    private sendSegment = (
        request: Request.Request,
        segment: Segment.Segment,
        entryNode: EntryNode,
        cacheEntry: RequestCache.Entry,
    ) => {
        const bef = performance.now();
        const conn = {
            apiEndpoint: entryNode.apiEndpoint,
            accessToken: entryNode.accessToken,
            hops: request.hops,
            relay: request.reqRelayPeerId,
        };
        NodeAPI.sendMessage(conn, {
            recipient: request.exitPeerId,
            tag: ApplicationTag,
            message: Segment.toMessage(segment),
        })
            .then((_json) => {
                const aft = performance.now();
                request.lastSegmentEndedAt = aft;
                const dur = Math.round(aft - bef);
                this.nodesColl.segmentSucceeded(request, segment, dur);
            })
            .catch((error) => {
                log.error(
                    'error sending %s: %s[%o]',
                    Segment.prettyPrint(segment),
                    JSON.stringify(error),
                    error,
                );
                this.nodesColl.segmentFailed(request, segment);
                this.resendRequest(request, entryNode, cacheEntry);
            });
    };

    private resendRequest = (
        origReq: Request.Request,
        entryNode: EntryNode,
        cacheEntry: RequestCache.Entry,
    ) => {
        if (this.redoRequests.has(origReq.id)) {
            log.verbose('ignoring already triggered resend', origReq.id);
            return;
        }

        // TODO track request after segments have been sent
        this.removeRequest(origReq);

        const fallback = this.nodesColl.fallbackNodePair(entryNode);
        if (!fallback) {
            log.info('no fallback for resending request available');
            return cacheEntry.reject('No fallback node pair to retry sending request');
        }

        this.redoRequests.add(origReq.id);
        if (fallback.entryNode.id === origReq.entryPeerId) {
            log.info('fallback entry node same as original entry node - still trying');
        }
        if (fallback.exitNode.id === origReq.exitPeerId) {
            log.info('fallback exit node same as original exit node - still trying');
        }

        // generate new request
        const id = RequestCache.generateId(this.requestCache);
        const resReq = Request.create({
            id,
            originalId: origReq.id,
            provider: origReq.provider,
            req: origReq.req,
            clientId: this.clientId,
            entryPeerId: fallback.entryNode.id,
            exitPeerId: fallback.exitNode.id,
            exitPublicKey: etherUtils.arrayify(fallback.exitNode.pubKey),
            counterOffset: fallback.counterOffset,
            measureRPClatency: origReq.measureRPClatency,
            headers: origReq.headers,
            hops: origReq.hops,
            reqRelayPeerId: fallback.reqRelayPeerId,
            respRelayPeerId: fallback.respRelayPeerId,
        });
        if (Res.isErr(resReq)) {
            log.error('error creating fallback request', resReq.error);
            return cacheEntry.reject('Unable to create fallback request object');
        }
        // split request to segments
        const { request, session } = resReq.res;
        const segments = Request.toSegments(request, session);
        const failMsg = this.checkSegmentLimit(segments.length);
        if (failMsg) {
            this.removeRequest(request);
            return cacheEntry.reject(failMsg);
        }

        // track request
        const newCacheEntry = RequestCache.add(this.requestCache, {
            request,
            resolve: cacheEntry.resolve,
            reject: cacheEntry.reject,
            timer: cacheEntry.timer,
            session,
        });
        this.nodesColl.requestStarted(request);

        // send request to hoprd
        log.info('resending request %s', Request.prettyPrint(request));

        // send segments sequentially
        segments.forEach((s) => this.resendSegment(s, request, entryNode, newCacheEntry));
    };

    private resendSegment = (
        segment: Segment.Segment,
        request: Request.Request,
        entryNode: EntryNode,
        cacheEntry: RequestCache.Entry,
    ) => {
        const bef = performance.now();
        NodeAPI.sendMessage(
            {
                apiEndpoint: entryNode.apiEndpoint,
                accessToken: entryNode.accessToken,
                hops: request.hops,
                relay: request.reqRelayPeerId,
            },
            {
                recipient: request.exitPeerId,
                tag: ApplicationTag,
                message: Segment.toMessage(segment),
            },
        )
            .then((_json) => {
                const aft = performance.now();
                request.lastSegmentEndedAt = aft;
                const dur = Math.round(aft - bef);
                this.nodesColl.segmentSucceeded(request, segment, dur);
            })
            .catch((error) => {
                log.error(
                    'error resending %s: %s[%o]',
                    Segment.prettyPrint(segment),
                    JSON.stringify(error),
                    error,
                );
                this.nodesColl.segmentFailed(request, segment);
                this.removeRequest(request);
                return cacheEntry.reject('Sending message failed');
            });
    };

    // handle incoming messages
    private onMessages = (messages: NodeAPI.Message[]) => {
        messages.forEach(({ body }) => {
            const segRes = Segment.fromMessage(body);
            if (Res.isErr(segRes)) {
                log.info('cannot create segment', segRes.error);
                return;
            }
            const segment = segRes.res;
            if (!this.requestCache.has(segment.requestId)) {
                log.info('dropping unrelated request segment', Segment.prettyPrint(segment));
                return;
            }

            const cacheRes = SegmentCache.incoming(this.segmentCache, segment);
            switch (cacheRes.res) {
                case 'complete':
                    log.verbose('completion segment', Segment.prettyPrint(segment));
                    this.completeSegmentsEntry(cacheRes.entry as SegmentCache.Entry);
                    break;
                case 'error':
                    log.error('error caching segment', cacheRes.reason);
                    break;
                case 'already-cached':
                    log.info('already cached', Segment.prettyPrint(segment));
                    break;
                case 'inserted-new':
                    log.verbose('inserted new first segment', Segment.prettyPrint(segment));
                    break;
                case 'added-to-request':
                    log.verbose(
                        'inserted new segment to existing requestId',
                        Segment.prettyPrint(segment),
                    );
                    break;
            }
        });
    };

    private completeSegmentsEntry = (entry: SegmentCache.Entry) => {
        const firstSeg = entry.segments.get(0) as Segment.Segment;
        if (!firstSeg.body.startsWith('0x')) {
            log.info('message is not a response', firstSeg.requestId);
            return;
        }

        const reqEntry = this.requestCache.get(firstSeg.requestId) as RequestCache.Entry;
        const { request, session } = reqEntry;
        RequestCache.remove(this.requestCache, request.id);

        const hexResp = SegmentCache.toMessage(entry);
        const respData = etherUtils.arrayify(hexResp);

        const resUnbox = Response.messageToResp({
            respData,
            request,
            session,
        });
        if (Res.isOk(resUnbox)) {
            return this.responseSuccess(resUnbox.res, reqEntry);
        }
        return this.responseError(resUnbox.error, reqEntry);
    };

    private responseError = (error: string, reqEntry: RequestCache.Entry) => {
        log.error('error extracting message', error);
        this.nodesColl.requestFailed(reqEntry.request);
        return reqEntry.reject('Unable to process response');
    };

    private responseSuccess = ({ resp }: Response.UnboxResponse, reqEntry: RequestCache.Entry) => {
        const { request, reject, resolve } = reqEntry;
        const responseTime = Math.round(performance.now() - request.startedAt);
        const stats = this.stats(responseTime, request, resp);
        log.verbose('response time for request %s: %d ms %o', request.id, responseTime, stats);
        this.nodesColl.requestSucceeded(request, responseTime);

        switch (resp.type) {
            case Payload.RespType.Resp: {
                const r: Response.Response = {
                    status: 200,
                    text: () => new Promise((r) => r(JSON.stringify(resp.resp))),
                    json: () => Promise.resolve(resp.resp),
                };
                if (request.measureRPClatency) {
                    r.stats = stats;
                }
                return resolve(r);
            }
            case Payload.RespType.CounterFail: {
                const counter = reqEntry.session.updatedTS;
                return reject(
                    `Message out of counter range. Exit node expected message counter near ${resp.now} - request got ${counter}.`,
                );
            }
            case Payload.RespType.DuplicateFail:
                return reject(
                    'Message duplicate error. Exit node rejected already processed message',
                );
            case Payload.RespType.HttpError: {
                const r: Response.Response = {
                    status: resp.status,
                    text: () => Promise.resolve(resp.text),
                    json: () => new Promise((r) => r(JSON.parse(resp.text))),
                };
                if (request.measureRPClatency) {
                    r.stats = stats;
                }
                return resolve(r);
            }
            case Payload.RespType.Error:
                return reject(`Error attempting JSON RPC call: ${resp.reason}`);
        }
    };

    private removeRequest = (request: Request.Request) => {
        this.nodesColl.requestFailed(request);
        RequestCache.remove(this.requestCache, request.id);
        SegmentCache.remove(this.segmentCache, request.id);
        if (request.originalId) {
            this.redoRequests.delete(request.originalId);
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
            segmentLimit: ops.segmentLimit ?? defaultOps.segmentLimit,
            versionListener: ops.versionListener,
            debugScope: ops.debugScope,
            logLevel: ops.logLevel || (process.env.DEBUG ? undefined : defaultOps.logLevel),
            forceManualRelaying,
            measureRPClatency,
        };
    };

    private requestOps = (ops?: RequestOps) => {
        if (ops) {
            return {
                timeout: ops.timeout || this.ops.timeout,
                provider: ops.provider || this.ops.provider,
                measureRPClatency: ops.measureRPClatency ?? this.ops.measureRPClatency,
            };
        }
        return this.ops;
    };

    private fetchChainId = async (provider: string) => {
        const req = JRPC.chainId(provider);

        // fetch request through RPCh
        const res = await this.doSend(req, { provider }).catch((err) =>
            log.warn('error fetching chainId for %s: %s[%o]', provider, JSON.stringify(err), err),
        );
        if (!res) {
            return;
        }

        // check HTTP response status and determine error
        if (res.status !== 200) {
            try {
                log.warn('unable to resolve chainId for %s: %s', provider, await res.text());
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
            const jrpc = await res.json();
            if (JRPC.isError(jrpc)) {
                log.warn(
                    'jrpc error response for chainId request to %s: %s',
                    provider,
                    JSON.stringify(jrpc.error),
                );
            } else {
                const id = parseInt(jrpc.result);
                log.info('determined chain id %d for %s', id, provider);
                this.chainIds.set(provider, id);
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

    private determineProvider = (
        { provider }: { provider: string },
        { method }: JRPC.Request,
    ): string => {
        if (this.ops.disableMevProtection) {
            return provider;
        }
        if (method !== 'eth_sendRawTransaction') {
            return provider;
        }
        // sanity check for chain id if we got it
        const cId = this.chainIds.get(provider);
        if (cId !== 1) {
            return provider;
        }
        return this.ops.mevProtectionProvider;
    };

    private determineHeaders = (
        provider: string,
        mevKickbackAddress?: string,
        headers?: Record<string, string>,
    ) => {
        if (provider === RPC_PROPELLORHEADS && mevKickbackAddress) {
            return { 'X-Tx-Origin': mevKickbackAddress, ...headers };
        }
        return headers;
    };

    private determineHops = (forceZeroHop: boolean) => {
        if (forceZeroHop) {
            return 0;
        }
        return 1;
    };

    private populateChainIds = (provider?: string) => {
        if (!provider) {
            return;
        }
        if (this.chainIds.has(provider)) {
            return;
        }
        this.fetchChainId(provider);
    };

    private checkSegmentLimit = (segLength: number) => {
        const limit = this.ops.segmentLimit;
        if (limit > 0 && segLength > limit) {
            log.error(
                'request exceeds maximum amount of segments[%i] with %i segments',
                limit,
                segLength,
            );
            const maxSize = Segment.MaxSegmentBody * limit;
            return `Request exceeds maximum size of ${maxSize}b`;
        }
    };

    private onVersions = (versions: DPapi.Versions) => {
        const vSdk = versions.sdk;
        const cmp = Utils.versionCompare(vSdk, Version);
        if (Res.isOk(cmp)) {
            switch (cmp.res) {
                case Utils.VrsnCmp.Identical:
                    log.verbose('RPCh SDK[v%s] is up to date', Version);
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

        // dont fetch exceptions on external code
        setTimeout(() => {
            this.ops.versionListener && this.ops.versionListener(versions);
        });
    };

    private stats = (responseTime: number, request: Request.Request, resp: Payload.RespPayload) => {
        const segDur = Math.round((request.lastSegmentEndedAt as number) - request.startedAt);
        if (
            request.measureRPClatency &&
            'rDur' in resp &&
            'eDur' in resp &&
            resp.rDur &&
            resp.eDur
        ) {
            const rpcDur = resp.rDur;
            const exitNodeDur = resp.eDur;
            const hoprDur = responseTime - rpcDur - exitNodeDur - segDur;
            return {
                segDur,
                rpcDur,
                exitNodeDur,
                hoprDur,
            };
        }
        return { segDur };
    };
}
