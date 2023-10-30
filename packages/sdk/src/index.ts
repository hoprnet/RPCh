import { utils as etherUtils } from 'ethers';

import * as JRPC from './jrpc';
import * as NodeAPI from './node-api';
import * as ProviderAPI from './provider-api';
import * as Request from './request';
import * as RequestCache from './request-cache';
import * as Response from './response';
import * as Segment from './segment';
import * as SegmentCache from './segment-cache';
import * as Utils from './utils';
import NodesCollector from './nodes-collector';
import type { EntryNode } from './entry-node';

export * as DPapi from './dp-api';
export * as JRPC from './jrpc';
export * as NodeAPI from './node-api';
export * as Payload from './payload';
export * as ProviderAPI from './provider-api';
export * as Request from './request';
export * as Response from './response';
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
};

/**
 * Overridable parameters per request.
 * See **Ops** for details.
 */
export type RequestOps = {
    readonly timeout?: number;
    readonly provider?: string;
};

const RPC_PROPELLORHEADS = 'https://rpc.propellerheads.xyz/eth';

/**
 * Global defaults.
 * See **Ops** for details.
 **/
const defaultOps: Ops = {
    discoveryPlatformEndpoint: 'https://discovery.rpch.tech',
    timeout: 10e3,
    provider: 'https://gnosis-provider.rpch.tech',
    disableMevProtection: false,
    mevProtectionProvider: RPC_PROPELLORHEADS,
    forceZeroHop: false,
    segmentLimit: 0, // disable segment limit
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
    private readonly redoRequests: Set<number> = new Set();
    private readonly counterStore: Map<string, bigint> = new Map();
    private readonly nodesColl: NodesCollector;
    private readonly ops: Ops;
    private readonly chainIds: Map<string, number> = new Map();

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
        this.requestCache = RequestCache.init();
        this.segmentCache = SegmentCache.init();
        this.nodesColl = new NodesCollector(
            this.ops.discoveryPlatformEndpoint as string,
            this.clientId,
            !!this.ops.forceZeroHop,
            ApplicationTag,
            this.onMessages,
        );
        this.fetchChainId(this.ops.provider as string);
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
    public async isReady(timeout?: number): Promise<boolean> {
        const t = timeout || (this.ops.timeout as number);
        return this.nodesColl.ready(t).then((_) => true);
    }

    /**
     * Send an **RPCrequest** via RPCh.
     * See **RequestOps** for overridable options.
     */
    public async send(req: JRPC.Request, ops?: RequestOps): Promise<Response.Response> {
        const reqOps = this.requestOps(ops);
        this.populateChainIds(ops?.provider);
        // TODO fixme
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            // sanity check provider url
            if (!Utils.isValidURL(reqOps.provider as string)) {
                return reject('Cannot parse provider URL');
            }
            // sanity check mev protection provider url, if it is set
            if (this.ops.mevProtectionProvider) {
                if (!Utils.isValidURL(this.ops.mevProtectionProvider)) {
                    return reject('Cannot parse mevProtectionProvider URL');
                }
            }

            // gather entry - exit node pair
            const resNodes = await this.nodesColl
                .requestNodePair(reqOps.timeout as number)
                .catch((err) => {
                    log.error('Error finding node pair', err);
                    return reject(`Could not find node pair in ${reqOps.timeout} ms`);
                });
            if (!resNodes) {
                return reject(`Unexpected code flow - should never be here`);
            }

            const provider = this.determineProvider(reqOps as { provider: string }, req);

            const headers = this.determineHeaders(provider, this.ops.mevKickbackAddress);

            const hops = this.determineHops(!!this.ops.forceZeroHop);

            // create request
            const { entryNode, exitNode } = resNodes;
            const id = RequestCache.generateId(this.requestCache);
            const resReq = Request.create({
                id,
                provider,
                req,
                clientId: this.clientId,
                entryPeerId: entryNode.id,
                exitPeerId: exitNode.id,
                exitPublicKey: etherUtils.arrayify(exitNode.pubKey),
                headers,
                hops,
            });

            if (!resReq.success) {
                log.error('Error creating request', resReq.error);
                return reject('Unable to create request object');
            }

            // split request to segments
            const request = resReq.req;
            const segments = Request.toSegments(request);
            const failMsg = this.checkSegmentLimit(segments.length);
            if (failMsg) {
                return reject(failMsg);
            }

            // set request expiration timer
            const timer = setTimeout(() => {
                log.error('request expired', request.id);
                this.removeRequest(request);
                return reject('request timed out');
            }, reqOps.timeout);

            // track request
            const entry = RequestCache.add(this.requestCache, request, resolve, reject, timer);
            this.nodesColl.requestStarted(request);

            // send request to hoprd
            log.info('sending request %i', request.id);

            // queue segment sending for all of them
            segments.forEach((s) =>
                setTimeout(() => {
                    this.nodesColl.segmentStarted(request, s);
                    this.sendSegment(request, s, entryNode, entry);
                }),
            );
        });
    }

    private sendSegment = (
        request: Request.Request,
        segment: Segment.Segment,
        entryNode: EntryNode,
        cacheEntry: RequestCache.Entry,
    ) => {
        const bef = Date.now();
        const conn = {
            apiEndpoint: entryNode.apiEndpoint,
            accessToken: entryNode.accessToken,
            hops: request.hops,
        };
        NodeAPI.sendMessage(conn, {
            recipient: request.exitPeerId,
            tag: ApplicationTag,
            message: Segment.toMessage(segment),
        })
            .then((_json) => {
                const dur = Date.now() - bef;
                this.nodesColl.segmentSucceeded(request, segment, dur);
            })
            .catch((error) => {
                log.error('error sending segment', Segment.prettyPrint(segment), error);
                this.nodesColl.segmentFailed(request, segment);
                this.resendRequest(request, entryNode, cacheEntry);
            });
    };

    private resendRequest(
        origReq: Request.Request,
        entryNode: EntryNode,
        cacheEntry: RequestCache.Entry,
    ) {
        if (this.redoRequests.has(origReq.id)) {
            log.verbose('ignoring already triggered resend', origReq.id);
            return;
        }

        // TODO track request after segments have been sent
        this.removeRequest(origReq);

        const fallback = this.nodesColl.fallbackNodePair(entryNode);
        if (!fallback) {
            log.info('no fallback for resending request available');
            return cacheEntry.reject('no fallback node pair to retry sending request');
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
            provider: origReq.provider,
            req: origReq.req,
            clientId: this.clientId,
            entryPeerId: fallback.entryNode.id,
            exitPeerId: fallback.exitNode.id,
            exitPublicKey: etherUtils.arrayify(fallback.exitNode.pubKey),
            headers: origReq.headers,
            hops: origReq.hops,
        });
        if (!resReq.success) {
            log.info('Error creating fallback request', resReq.error);
            return cacheEntry.reject('unable to create fallback request object');
        }
        // split request to segments
        const request = resReq.req;
        const segments = Request.toSegments(request);
        const failMsg = this.checkSegmentLimit(segments.length);
        if (failMsg) {
            this.removeRequest(request);
            return cacheEntry.reject(failMsg);
        }

        // track request
        const newCacheEntry = RequestCache.add(
            this.requestCache,
            request,
            cacheEntry.resolve,
            cacheEntry.reject,
            cacheEntry.timer,
        );
        this.nodesColl.requestStarted(request);

        // send request to hoprd
        log.info('resending request %i', request.id, 'for original', origReq.id);

        // send segments sequentially
        segments.forEach((s) =>
            setTimeout(() => this.resendSegment(s, request, entryNode, newCacheEntry)),
        );
    }

    private resendSegment = (
        segment: Segment.Segment,
        request: Request.Request,
        entryNode: EntryNode,
        cacheEntry: RequestCache.Entry,
    ) => {
        const bef = Date.now();
        NodeAPI.sendMessage(
            {
                apiEndpoint: entryNode.apiEndpoint,
                accessToken: entryNode.accessToken,
                hops: request.hops,
            },
            {
                recipient: request.exitPeerId,
                tag: ApplicationTag,
                message: Segment.toMessage(segment),
            },
        )
            .then((_json) => {
                const dur = Date.now() - bef;
                this.nodesColl.segmentSucceeded(request, segment, dur);
            })
            .catch((error) => {
                log.error('error resending segment', Segment.prettyPrint(segment), error);
                this.nodesColl.segmentFailed(request, segment);
                this.removeRequest(request);
                return cacheEntry.reject('Sending message failed');
            });
    };

    // handle incoming messages
    private onMessages = (messages: NodeAPI.Message[]) => {
        messages.forEach(({ body }) => {
            const segRes = Segment.fromMessage(body);
            if (!segRes.success) {
                log.info('cannot create segment', segRes.error);
                return;
            }
            const segment = segRes.segment;
            if (!this.requestCache.has(segment.requestId)) {
                log.info('dropping unrelated request segment', Segment.prettyPrint(segment));
                return;
            }

            const cacheRes = SegmentCache.incoming(this.segmentCache, segment);
            switch (cacheRes.res) {
                case 'complete':
                    log.verbose('completion segment', Segment.prettyPrint(segment));
                    this.completeSegmentsEntry(cacheRes.entry!);
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
        const firstSeg = entry.segments.get(0)!;
        if (!firstSeg.body.startsWith('0x')) {
            log.info('message is not a response', firstSeg.requestId);
            return;
        }

        const request = this.requestCache.get(firstSeg.requestId)!;
        RequestCache.remove(this.requestCache, request.id);

        const hexResp = SegmentCache.toMessage(entry);
        const respData = etherUtils.arrayify(hexResp);
        const counter = this.counterStore.get(request.exitPeerId) || BigInt(0);

        const res = Response.messageToResp({
            respData,
            request,
            counter,
        });
        switch (res.res) {
            case 'error':
                return this.responseError(res, request);
            case 'counterfail':
                return this.responseCounterFail(res, request, counter);
            case 'success':
                return this.responseSuccess(res, request);
        }
    };

    private responseError = (res: Response.RespError, request: RequestCache.Entry) => {
        log.error('Error extracting message', res.reason);
        this.nodesColl.requestFailed(request);
        return request.reject('Unable to process response');
    };

    private responseCounterFail = (
        res: Response.RespCounterFail,
        request: RequestCache.Entry,
        counter: bigint,
    ) => {
        log.info(
            'Counter mismatch extracting message: last counter %s, new counter %s',
            counter,
            res.counter,
        );
        this.nodesColl.requestFailed(request);
        return request.reject(
            `Check your time settings! Out of order message from exit node - last counter: ${counter}, new counter ${res.counter}.`,
        );
    };

    private responseSuccess = (res: Response.RespSuccess, request: RequestCache.Entry) => {
        this.counterStore.set(request.exitPeerId, res.counter);
        const responseTime = Date.now() - request.createdAt;
        log.verbose('response time for request %s: %s ms', request.id, responseTime);
        this.nodesColl.requestSucceeded(request, responseTime);

        const resp = res.resp;
        switch (resp.type) {
            case 'error':
                return request.reject(`Error attempting JSON RPC call: ${resp.reason}`);
            case 'counterfail':
                return request.reject(
                    `Out of order message. Exit node expected message counter between ${resp.min} and ${resp.max}. Check your time settings!`,
                );
            case 'httperror':
                return request.resolve({
                    status: resp.status,
                    text: () => Promise.resolve(resp.text),
                    json: () => new Promise((r) => r(JSON.parse(resp.text))),
                });
            case 'resp':
                return request.resolve({
                    status: 200,
                    text: () => new Promise((r) => r(JSON.stringify(resp.resp))),
                    json: () => Promise.resolve(resp.resp),
                });
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

    private sdkOps = (ops: Ops): Ops => {
        return {
            discoveryPlatformEndpoint:
                ops.discoveryPlatformEndpoint || defaultOps.discoveryPlatformEndpoint,
            timeout: ops.timeout || defaultOps.timeout,
            provider: ops.provider || defaultOps.provider,
            disableMevProtection: ops.disableMevProtection ?? defaultOps.disableMevProtection,
            mevProtectionProvider: ops.mevProtectionProvider || defaultOps.mevProtectionProvider,
            forceZeroHop: ops.forceZeroHop ?? defaultOps.forceZeroHop,
            segmentLimit: ops.segmentLimit ?? defaultOps.segmentLimit,
        };
    };

    private requestOps = (ops?: RequestOps): RequestOps => {
        if (ops) {
            return {
                timeout: ops.timeout || this.ops.timeout,
                provider: ops.provider || this.ops.provider,
            };
        }
        return this.ops;
    };

    private fetchChainId = async (provider: string) => {
        const res = await ProviderAPI.fetchChainId(provider).catch((err) =>
            log.error('Error fetching chainId for', provider, JSON.stringify(err)),
        );
        if (!res) {
            return;
        }
        if (JRPC.isError(res)) {
            log.info('Unable to resolve chainId for', provider, JSON.stringify(res.error));
            return;
        }
        const id = parseInt(res.result, 16);
        this.chainIds.set(provider, id);
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
        return this.ops.mevProtectionProvider as string;
    };

    private determineHeaders = (provider: string, mevKickbackAddress?: string) => {
        if (provider === RPC_PROPELLORHEADS && mevKickbackAddress) {
            return { 'X-Tx-Origin': mevKickbackAddress };
        }
    };

    private determineHops(forceZeroHop: boolean) {
        // defaults to multihop (novalue)
        if (forceZeroHop) {
            return 0;
        }
    }

    private populateChainIds(provider?: string) {
        if (!provider) {
            return;
        }
        if (this.chainIds.has(provider)) {
            return;
        }
        this.fetchChainId(provider);
    }

    private checkSegmentLimit(segLength: number) {
        const limit = this.ops.segmentLimit as number;
        if (limit > 0 && segLength > limit) {
            log.error(
                'Request exceeds maximum amount of segments[%i] with %i segments',
                limit,
                segLength,
            );
            const maxSize = Segment.MaxSegmentBody * limit;
            return `Request exceeds maximum size of ${maxSize}b`;
        }
    }
}
