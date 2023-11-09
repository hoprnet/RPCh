import * as path from 'path';
import WS from 'isomorphic-ws';
import { utils } from 'ethers';

import * as Identity from './identity';
import * as RequestStore from './request-store';
import Version from './version';
import {
    DPapi,
    ExitNode,
    NodeAPI,
    Payload,
    ProviderAPI,
    Request,
    Response,
    Result as Res,
    Segment,
    SegmentCache,
    Utils,
} from '@rpch/sdk';

const log = Utils.logger(['exit-node']);

const SocketReconnectTimeout = 1e3; // 1sek
const RequestPurgeTimeout = 10e3; // 10sek
const ValidCounterPeriod = 1e3 * 60 * 60; // 1hour

type State = {
    socket?: WS.WebSocket;
    publicKey: string;
    privateKey: Uint8Array;
    peerId: string;
    cache: SegmentCache.Cache;
    deleteTimer: Map<string, ReturnType<typeof setTimeout>>; // deletion timer of requests in segment cache
    requestStore: RequestStore.RequestStore;
};

type Ops = {
    privateKey?: Uint8Array;
    identityFile: string;
    password?: string;
    apiEndpoint: URL;
    accessToken: string;
    discoveryPlatformEndpoint: string;
    nodeAccessToken: string;
    dbFile: string;
};

type Msg = {
    type: string;
    tag: number;
    body: string;
};

async function start(ops: Ops) {
    const state = await setup(ops).catch(() => {
        log.error(
            'Fatal error initializing %s',
            ExitNode.prettyPrint('(unknown)', Version, Date.now()),
        );
    });
    if (!state) {
        process.exit(1);
    }
    setupSocket(state, ops);
    cleanup(state);
}

async function setup(ops: Ops): Promise<State> {
    const requestStore = await RequestStore.setup(ops.dbFile).catch((err) => {
        log.error('Error setting up request store:', err);
    });
    if (!requestStore) {
        return Promise.reject();
    }

    log.verbose('Set up DB at', ops.dbFile);

    const resId = await Identity.getIdentity({
        identityFile: ops.identityFile,
        password: ops.password,
        privateKey: ops.privateKey,
    }).catch((err: Error) => {
        log.error('Error accessing identity', err);
    });
    if (!resId) {
        return Promise.reject();
    }

    log.verbose('Got identity', resId.publicKey);

    const resPeerId = await NodeAPI.accountAddresses(ops).catch((err: Error) => {
        log.error('Error fetching account addresses', err);
    });
    if (!resPeerId) {
        return Promise.reject();
    }

    const { hopr: peerId } = resPeerId;
    const cache = SegmentCache.init();
    const deleteTimer = new Map();

    const logOpts = {
        identityFile: ops.identityFile,
        apiEndpoint: ops.apiEndpoint,
        discoveryPlatformEndpoint: ops.discoveryPlatformEndpoint,
    };
    log.verbose(
        '%s started with %s',
        ExitNode.prettyPrint(peerId, Version, Date.now()),
        JSON.stringify(logOpts),
    );

    return {
        cache,
        deleteTimer,
        privateKey: utils.arrayify(resId.privateKey),
        peerId,
        publicKey: resId.publicKey,
        requestStore,
    };
}

function setupSocket(state: State, ops: Ops) {
    const socket = NodeAPI.connectWS(ops);
    if (!socket) {
        log.error('Failed opening websocket');
        process.exit(3);
    }

    socket.onmessage = onMessage(state, ops);

    socket.on('error', (err: Error) => {
        log.error('Websocket error', err);
        // attempt reconnect
        setTimeout(() => setupSocket(state, ops), SocketReconnectTimeout);
    });

    socket.on('close', (evt: WS.CloseEvent) => {
        log.error('Websocket close', evt);
        // attempt reconnect
        setTimeout(() => setupSocket(state, ops), SocketReconnectTimeout);
    });

    socket.on('open', () => {
        log.verbose('Opened websocket listener');
    });

    state.socket = socket;
}

function cleanup(state: State) {
    RequestStore.removeExpired(state.requestStore, ValidCounterPeriod)
        .then(() => {
            log.info('Successfully ran removeExpired on requestStore');
        })
        .catch((err) => {
            log.error('Error during cleanup:', err);
        })
        .finally(() => {
            scheduleCleanup(state);
        });
}

function scheduleCleanup(state: State) {
    // schdule next run somehwere between 1h and 1h and 10m
    const next = ValidCounterPeriod + Math.floor(Math.random() * 10 * 60e3);
    const logH = Math.floor(next / 1000 / 60 / 60);
    const logM = Math.round(next / 1000 / 60) - logH * 60;

    log.verbose('Scheduling next cleanup in %dh%dm', logH, logM);
    setTimeout(() => cleanup(state), next);
}

function onMessage(state: State, ops: Ops) {
    return function (evt: WS.MessageEvent) {
        const raw = evt.data.toString();
        const msg = JSON.parse(raw) as Msg;

        if (msg.type !== 'message') {
            return;
        }

        // determine if ping req
        if (msg.body.startsWith('ping-')) {
            return onPingReq(state, ops, msg);
        }

        // deterine if info req
        if (msg.body.startsWith('info-')) {
            return onInfoReq(state, ops, msg);
        }

        // determine if valid segment
        const segRes = Segment.fromMessage(msg.body);
        if (Res.isErr(segRes)) {
            log.info('Cannot create segment:', segRes.error);
            return;
        }

        const segment = segRes.res;
        const cacheRes = SegmentCache.incoming(state.cache, segment);
        switch (cacheRes.res) {
            case 'complete':
                log.verbose('Completing segment:', Segment.prettyPrint(segment));
                clearTimeout(state.deleteTimer.get(segment.requestId));
                completeSegmentsEntry(state, ops, cacheRes.entry as SegmentCache.Entry, msg.tag);
                break;
            case 'error':
                log.error('Error caching segment:', cacheRes.reason);
                break;
            case 'already-cached':
                log.info('Already cached:', Segment.prettyPrint(segment));
                break;
            case 'added-to-request':
                log.verbose(
                    'Inserted new segment to existing request:',
                    Segment.prettyPrint(segment),
                );
                break;
            case 'inserted-new':
                log.verbose('Inserted new first segment:', Segment.prettyPrint(segment));
                state.deleteTimer.set(
                    segment.requestId,
                    setTimeout(() => {
                        log.info('Purging incomplete request:', segment.requestId);
                        SegmentCache.remove(state.cache, segment.requestId);
                    }, RequestPurgeTimeout),
                );
                break;
        }
    };
}

function onPingReq(state: State, ops: Ops, msg: Msg) {
    log.info('Received ping req:', msg.body);
    // ping-originPeerId
    const [, recipient] = msg.body.split('-');
    const conn = { ...ops, hops: 0 };
    NodeAPI.sendMessage(conn, {
        recipient,
        tag: msg.tag,
        message: `pong-${state.peerId}`,
    }).catch((err) => {
        log.error('Error sending pong:', err);
    });
}

function onInfoReq(state: State, ops: Ops, msg: Msg) {
    log.info('Received info req:', msg.body);
    // info-originPeerId-hops
    const [, recipient, hopsStr] = msg.body.split('-');
    const hops = parseInt(hopsStr, 10);
    const conn = { ...ops, hops };
    const info = {
        peerId: state.peerId,
        counter: Date.now(),
        version: Version,
    };
    const res = Payload.encodeInfo(info);
    if (Res.isErr(res)) {
        log.error('Error encoding info:', res.error);
        return;
    }
    const message = `nfrp-${res.res}`;
    NodeAPI.sendMessage(conn, {
        recipient,
        tag: msg.tag,
        message,
    }).catch((err) => {
        log.error('Error sending info:', err);
    });
}

async function completeSegmentsEntry(
    state: State,
    ops: Ops,
    cacheEntry: SegmentCache.Entry,
    tag: number,
) {
    const firstSeg = cacheEntry.segments.get(0) as Segment.Segment;
    if (!firstSeg.body.startsWith('0x')) {
        log.info('Message is not a request:', firstSeg.requestId);
        return;
    }
    const requestId = firstSeg.requestId;
    const msg = SegmentCache.toMessage(cacheEntry);
    const msgParts = msg.split(',');
    if (msgParts.length !== 2) {
        log.info('Invalid message parts:', msgParts);
        return;
    }

    const [hexEntryId, hexData] = msgParts;
    const entryIdData = utils.arrayify(hexEntryId);
    const entryPeerId = utils.toUtf8String(entryIdData);
    const reqData = utils.arrayify(hexData);

    const resReq = Request.messageToReq({
        message: reqData,
        exitPeerId: state.peerId,
        exitPrivateKey: state.privateKey,
    });

    if (Res.isErr(resReq)) {
        log.error('Error unboxing request:', resReq.error);
        return;
    }

    const unboxRequest = resReq.res;
    const { reqPayload, session: unboxSession } = unboxRequest;
    const sendParams = { ops, entryPeerId, cacheEntry, tag, unboxRequest };

    // check counter
    const counter = Number(unboxSession.updatedTS);
    const now = Date.now();
    const valid = now - ValidCounterPeriod;
    if (counter < valid) {
        log.info('Counter %d outside valid period %d (now: %d)', counter, valid, now);
        // counter fail resp
        return sendResponse(sendParams, { type: Payload.RespType.CounterFail, now });
    }

    // check uuid
    const res = await RequestStore.addIfAbsent(state.requestStore, requestId, counter);
    if (res === RequestStore.AddRes.Duplicate) {
        log.info('Duplicate request id');
        // duplicate fail resp
        return sendResponse(sendParams, { type: Payload.RespType.DuplicateFail });
    }

    // do RPC request
    const { provider, req, headers } = reqPayload;
    const resFetch = await ProviderAPI.fetchRPC(provider, req, headers).catch((err: Error) => {
        log.error(
            'Error RPC requesting %s with %s: %s',
            provider,
            JSON.stringify(req),
            JSON.stringify(err),
        );
        // rpc critical fail response
        return sendResponse(sendParams, {
            type: Payload.RespType.Error,
            reason: JSON.stringify(err),
        });
    });
    if (!resFetch) {
        return;
    }

    // http fail response
    if (Res.isErr(resFetch)) {
        const { status, message: text } = resFetch.error;
        return sendResponse(sendParams, { type: Payload.RespType.HttpError, status, text });
    }

    const resp = resFetch.res;
    return sendResponse(sendParams, { type: Payload.RespType.Resp, resp });
}

function sendResponse(
    {
        ops,
        entryPeerId,
        cacheEntry,
        tag,
        unboxRequest: { session: unboxSession, reqPayload },
    }: {
        ops: Ops;
        entryPeerId: string;
        tag: number;
        cacheEntry: SegmentCache.Entry;
        unboxRequest: Request.UnboxRequest;
    },
    respPayload: Payload.RespPayload,
) {
    const resResp = Response.respToMessage({
        entryPeerId,
        respPayload,
        unboxSession,
    });
    if (Res.isErr(resResp)) {
        log.error('Error boxing response', resResp.error);
        return;
    }

    const requestId = (cacheEntry.segments.get(0) as Segment.Segment).requestId;
    const segments = Segment.toSegments(requestId, resResp.res);

    log.verbose(
        'Returning message to %s, tag: %s, requestId: %i',
        Utils.shortPeerId(entryPeerId),
        tag,
        requestId,
    );

    const conn = {
        ...ops,
        hops: reqPayload.hops,
    };

    // queue segment sending for all of them
    segments.forEach((seg: Segment.Segment) => {
        setTimeout(() => {
            NodeAPI.sendMessage(conn, {
                recipient: entryPeerId,
                tag,
                message: Segment.toMessage(seg),
            }).catch((err: Error) => {
                log.error('Error sending segment:', Segment.prettyPrint(seg), err);
            });
        });
    });

    // inform DP non blocking
    setTimeout(() => {
        const lastReqSeg = cacheEntry.segments.get(cacheEntry.count - 1) as Segment.Segment;
        const quotaRequest: DPapi.QuotaParams = {
            clientId: reqPayload.clientId,
            rpcMethod: reqPayload.req.method,
            segmentCount: cacheEntry.count,
            lastSegmentLength: lastReqSeg.body.length,
            type: 'request',
        };

        const lastRespSeg = segments[segments.length - 1];
        const quotaResponse: DPapi.QuotaParams = {
            clientId: reqPayload.clientId,
            rpcMethod: reqPayload.req.method,
            segmentCount: segments.length,
            lastSegmentLength: lastRespSeg.body.length,
            type: 'response',
        };

        DPapi.fetchQuota(ops, quotaRequest).catch((ex) => {
            log.error('Error recording request quota:', ex);
        });
        DPapi.fetchQuota(ops, quotaResponse).catch((ex) => {
            log.error('Error recording response quota:', ex);
        });
    }, segments.length);
}

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
    if (!process.env.RPCH_PRIVATE_KEY && !process.env.RPCH_PASSWORD) {
        throw new Error("Missing 'RPCH_PRIVATE_KEY' or 'RPCH_PASSWORD' env var.");
    }

    if (!process.env.HOPRD_API_ENDPOINT) {
        throw new Error("Missing 'HOPRD_API_ENDPOINT' env var.");
    }
    if (!process.env.HOPRD_API_TOKEN) {
        throw new Error("Missing 'HOPRD_API_TOKEN' env var.");
    }
    if (!process.env.DISCOVERY_PLATFORM_API_ENDPOINT) {
        throw new Error("Missing 'DISCOVERY_PLATFORM_API_ENDPOINT' env var.");
    }
    if (!process.env.DISCOVERY_PLATFORM_ACCESS_TOKEN) {
        throw new Error("Missing 'DISCOVERY_PLATFORM_ACCESS_TOKEN' env var.");
    }
    if (!process.env.RPCH_DB_FILE) {
        throw new Error('Missing RPCH_DB_FILE env var.');
    }
    const identityFile = process.env.RPCH_IDENTITY_FILE || path.join(process.cwd(), '.identity');
    const privateKey = process.env.RPCH_PRIVATE_KEY
        ? utils.arrayify(process.env.RPCH_PRIVATE_KEY)
        : undefined;

    start({
        privateKey,
        identityFile,
        password: process.env.RPCH_PASSWORD,
        apiEndpoint: new URL(process.env.HOPRD_API_ENDPOINT),
        accessToken: process.env.HOPRD_API_TOKEN,
        discoveryPlatformEndpoint: process.env.DISCOVERY_PLATFORM_API_ENDPOINT,
        nodeAccessToken: process.env.DISCOVERY_PLATFORM_ACCESS_TOKEN,
        dbFile: process.env.RPCH_DB_FILE,
    });
}
