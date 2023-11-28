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
const RequestPurgeTimeout = 60e3; // 60sek
const ValidCounterPeriod = 1e3 * 60 * 60; // 1hour
const RelayNodesCompatVersions = ['2.0.4'];
const SetupRelayPeriod = 1e3 * 60 * 15; // 15 min

type State = {
    socket?: WS.WebSocket;
    publicKey: string;
    privateKey: Uint8Array;
    peerId: string;
    cache: SegmentCache.Cache;
    deleteTimer: Map<string, ReturnType<typeof setTimeout>>; // deletion timer of requests in segment cache
    requestStore: RequestStore.RequestStore;
    relays: string[];
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
        log.error('error initializing %s', ExitNode.prettyPrint('(unknown)', Version, Date.now()));
    });
    if (!state) {
        process.exit(1);
    }
    setupSocket(state, ops);
    cleanup(state);
    setupRelays(state, ops);
}

async function setup(ops: Ops): Promise<State> {
    const requestStore = await RequestStore.setup(ops.dbFile).catch((err) => {
        log.error('error setting up request store: %s[%o]', JSON.stringify(err), err);
    });
    if (!requestStore) {
        return Promise.reject();
    }

    log.verbose('set up DB at', ops.dbFile);

    const resId = await Identity.getIdentity({
        identityFile: ops.identityFile,
        password: ops.password,
        privateKey: ops.privateKey,
    }).catch((err: Error) => {
        log.error('error accessing identity: %s[%o]', JSON.stringify(err), err);
    });
    if (!resId) {
        return Promise.reject();
    }

    log.verbose('got identity', resId.publicKey);

    const resPeerId = await NodeAPI.accountAddresses(ops).catch((err: Error) => {
        log.error('error fetching account addresses: %s[%o]', JSON.stringify(err), err);
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
    log.info('%s started with %o', ExitNode.prettyPrint(peerId, Version, Date.now()), logOpts);

    return {
        cache,
        deleteTimer,
        privateKey: utils.arrayify(resId.privateKey),
        peerId,
        publicKey: resId.publicKey,
        requestStore,
        relays: [],
    };
}

function setupSocket(state: State, ops: Ops) {
    const socket = NodeAPI.connectWS(ops);
    if (!socket) {
        log.error('error opening websocket');
        process.exit(3);
    }

    socket.onmessage = onMessage(state, ops);

    socket.on('error', (err: Error) => {
        log.error('error on socket: %s[%o]', JSON.stringify(err), err);
        socket.onmessage = false;
        socket.close();
    });

    socket.on('close', (evt: WS.CloseEvent) => {
        log.warn('closing socket %o - attempting reconnect', evt);
        // attempt reconnect
        setTimeout(() => setupSocket(state, ops), SocketReconnectTimeout);
    });

    socket.on('open', () => {
        log.verbose('opened websocket listener');
    });

    state.socket = socket;
}

function cleanup(state: State) {
    RequestStore.removeExpired(state.requestStore, ValidCounterPeriod)
        .then(() => {
            log.info('successfully removed expired requests from store');
        })
        .catch((err) => {
            log.error('error during cleanup: %s[%o]', JSON.stringify(err), err);
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

    log.info('scheduling next cleanup in %dh%dm', logH, logM);
    setTimeout(() => cleanup(state), next);
}

async function setupRelays(state: State, ops: Ops) {
    try {
        const resPeers = await NodeAPI.getPeers(ops);
        if (NodeAPI.isError(resPeers)) {
            throw new Error(`node internal: ${JSON.stringify(resPeers)}`);
        }

        // available peers
        const relays = resPeers.connected
            .filter(({ reportedVersion }) =>
                RelayNodesCompatVersions.some((v) => reportedVersion.startsWith(v)),
            )
            .map(({ peerId, peerAddress }) => ({ peerId, peerAddress }));

        const resChannels = await NodeAPI.getNodeChannels(ops);

        // open channels
        const openChannelsArr = resChannels.outgoing
            .filter(({ status }) => status === 'Open')
            .map(({ peerAddress }) => peerAddress);
        const openChannels = new Set(openChannelsArr);
        state.relays = relays
            .filter(({ peerAddress }) => openChannels.has(peerAddress))
            .map(({ peerId }) => peerId);
        log.info('found %d potential relays', relays.length);
    } catch (err) {
        log.error('error during relay setup: %s[%o]', err);
    } finally {
        setTimeout(() => scheduleSetupRelays(state, ops));
    }
}

function scheduleSetupRelays(state: State, ops: Ops) {
    // schdule next run somehwere between 15min and 20min
    const next = SetupRelayPeriod + Math.floor(Math.random() * 5 * 60e3);
    const logM = Math.floor(next / 1000 / 60);
    const logS = Math.round(next / 1000) - logM * 60;

    log.info('scheduling next setup relays in %dm%ds', logM, logS);
    setTimeout(() => setupRelays(state, ops), next);
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
            log.info('cannot create segment:', segRes.error);
            return;
        }

        const segment = segRes.res;
        const cacheRes = SegmentCache.incoming(state.cache, segment);
        switch (cacheRes.res) {
            case 'complete':
                log.verbose('completing segment:', Segment.prettyPrint(segment));
                clearTimeout(state.deleteTimer.get(segment.requestId));
                completeSegmentsEntry(state, ops, cacheRes.entry as SegmentCache.Entry, msg.tag);
                break;
            case 'error':
                log.error('error caching segment:', cacheRes.reason);
                break;
            case 'already-cached':
                log.info('already cached:', Segment.prettyPrint(segment));
                break;
            case 'added-to-request':
                log.verbose(
                    'inserted new segment to existing request:',
                    Segment.prettyPrint(segment),
                );
                break;
            case 'inserted-new':
                log.verbose('inserted new first segment:', Segment.prettyPrint(segment));
                state.deleteTimer.set(
                    segment.requestId,
                    setTimeout(() => {
                        log.info('purging incomplete request:', segment.requestId);
                        SegmentCache.remove(state.cache, segment.requestId);
                    }, RequestPurgeTimeout),
                );
                break;
        }
    };
}

function onPingReq(state: State, ops: Ops, msg: Msg) {
    log.info('received ping req:', msg.body);
    // ping-originPeerId
    const [, recipient] = msg.body.split('-');
    const conn = { ...ops, hops: 0 };
    NodeAPI.sendMessage(conn, {
        recipient,
        tag: msg.tag,
        message: `pong-${state.peerId}`,
    }).catch((err) => {
        log.error('error sending pong: %s[%o]', JSON.stringify(err), err);
    });
}

function onInfoReq(state: State, ops: Ops, msg: Msg) {
    log.info('received info req:', msg.body);
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
        log.error('error encoding info:', res.error);
        return;
    }
    const message = `nfrp-${res.res}`;
    NodeAPI.sendMessage(conn, {
        recipient,
        tag: msg.tag,
        message,
    }).catch((err) => {
        log.error('error sending info: %s[%o]', JSON.stringify(err), err);
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
        log.info('message is not a request:', firstSeg.requestId);
        return;
    }
    const requestId = firstSeg.requestId;
    const msg = SegmentCache.toMessage(cacheEntry);
    const msgParts = msg.split(',');
    if (msgParts.length !== 2) {
        log.info('invalid message parts:', msgParts);
        return;
    }

    const [hexEntryId, hexData] = msgParts;
    const entryIdData = utils.arrayify(hexEntryId);
    const entryPeerId = utils.toUtf8String(entryIdData);
    const reqData = utils.arrayify(hexData);

    const resReq = Request.messageToReq({
        requestId,
        message: reqData,
        exitPeerId: state.peerId,
        exitPrivateKey: state.privateKey,
    });

    if (Res.isErr(resReq)) {
        log.error('error unboxing request:', resReq.error);
        return;
    }

    const unboxRequest = resReq.res;
    const { reqPayload, session: unboxSession } = unboxRequest;
    const relay = determineRelay(state, reqPayload);
    const sendParams = { state, ops, entryPeerId, cacheEntry, tag, relay, unboxRequest };

    // check counter
    const counter = Number(unboxSession.updatedTS);
    const now = Date.now();
    const valid = now - ValidCounterPeriod;
    if (counter < valid) {
        log.info('counter %d outside valid period %d (now: %d)', counter, valid, now);
        // counter fail resp
        return sendResponse(sendParams, { type: Payload.RespType.CounterFail, now });
    }

    // check uuid
    const res = await RequestStore.addIfAbsent(state.requestStore, requestId, counter);
    if (res === RequestStore.AddRes.Duplicate) {
        log.info('duplicate request id:', requestId);
        // duplicate fail resp
        return sendResponse(sendParams, { type: Payload.RespType.DuplicateFail });
    }

    // do RPC request
    const { provider, req, headers } = reqPayload;
    const resFetch = await ProviderAPI.fetchRPC(provider, req, headers).catch((err: Error) => {
        log.error(
            'error doing JRPC on %s with %o: %s[%o]',
            provider,
            req,
            JSON.stringify(err),
            err,
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

/**
 * The exit node will only select a relay if one was given via request payload.
 * It will check if that is a valid relay, otherwise it will choose one of the relays determine by itself.
 */
function determineRelay(
    state: State,
    { hops, respRelayPeerId }: { hops?: number; respRelayPeerId?: string },
) {
    if (hops === 0) {
        return;
    }
    if (respRelayPeerId) {
        if (state.relays.includes(respRelayPeerId)) {
            return respRelayPeerId;
        } else {
            return Utils.randomEl(state.relays);
        }
    }
}

function sendResponse(
    {
        state,
        ops,
        entryPeerId,
        cacheEntry,
        tag,
        unboxRequest: { session: unboxSession, reqPayload },
        relay,
    }: {
        state: State;
        ops: Ops;
        entryPeerId: string;
        tag: number;
        cacheEntry: SegmentCache.Entry;
        unboxRequest: Request.UnboxRequest;
        relay?: string;
    },
    respPayload: Payload.RespPayload,
) {
    const requestId = (cacheEntry.segments.get(0) as Segment.Segment).requestId;
    const resResp = Response.respToMessage({
        requestId,
        entryPeerId,
        respPayload,
        unboxSession,
    });
    if (Res.isErr(resResp)) {
        log.error('error boxing response:', resResp.error);
        return;
    }

    const segments = Segment.toSegments(requestId, resResp.res);

    const relayString = relay ? `(${Utils.shortPeerId(relay)})` : '';

    log.verbose(
        'returning message to %s%s, tag: %s, requestId: %s',
        Utils.shortPeerId(entryPeerId),
        relayString,
        tag,
        requestId,
    );

    const conn = {
        ...ops,
        hops: reqPayload.hops,
        respRelayPeerId: relay,
    };

    // queue segment sending for all of them
    segments.forEach((seg: Segment.Segment) => {
        setTimeout(() => {
            NodeAPI.sendMessage(conn, {
                recipient: entryPeerId,
                tag,
                message: Segment.toMessage(seg),
            }).catch((err: Error) => {
                log.error(
                    'error sending %s: %s[%o]',
                    Segment.prettyPrint(seg),
                    JSON.stringify(err),
                    err,
                );
                // remove relay if it fails
                state.relays = state.relays.filter((r) => r !== relay);
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

        DPapi.fetchQuota(ops, quotaRequest).catch((err) => {
            log.error('error recording request quota: %s[%o]', JSON.stringify(err), err);
        });
        DPapi.fetchQuota(ops, quotaResponse).catch((err) => {
            log.error('error recording response quota: %s[%o]', JSON.stringify(err), err);
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
