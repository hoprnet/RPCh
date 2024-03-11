import * as compatCrypto from '@rpch/compat-crypto';

import * as Res from './result';
import * as JRPC from './jrpc';
import * as Payload from './payload';
import * as Segment from './segment';
import * as Utils from './utils';

export type Request = {
    id: string; // uuid
    originalId?: string;
    provider: string;
    req: JRPC.Request;
    entryPeerId: string;
    exitPeerId: string;
    startedAt: number;
    measureRPClatency: boolean;
    lastSegmentEndedAt?: number;
    headers?: Record<string, string>;
    hops?: number;
    reqRelayPeerId?: string;
    respRelayPeerId?: string;
};

export type UnboxRequest = {
    reqPayload: Payload.ReqPayload;
    session: compatCrypto.Session;
};

/**
 * Creates a request and compresses its payload.
 */
export function create({
    id,
    originalId,
    provider,
    req,
    clientId,
    entryPeerId,
    exitPeerId,
    exitPublicKey,
    counterOffset,
    measureRPClatency,
    headers,
    hops,
    reqRelayPeerId,
    respRelayPeerId,
}: {
    id: string;
    originalId?: string;
    provider: string;
    req: JRPC.Request;
    clientId: string;
    entryPeerId: string;
    exitPeerId: string;
    exitPublicKey: Uint8Array;
    counterOffset: number;
    measureRPClatency: boolean;
    headers?: Record<string, string>;
    hops?: number;
    reqRelayPeerId?: string;
    respRelayPeerId?: string;
}): Res.Result<{ request: Request; session: compatCrypto.Session }> {
    const payload: Payload.ReqPayload = {
        endpoint: provider,
        clientId,
        body: JSON.stringify(req),
        headers,
        method: 'POST',
        hops,
        relayPeerId: respRelayPeerId,
        withDuration: measureRPClatency,
    };
    const resEncode = Payload.encodeReq(payload);
    if (Res.isErr(resEncode)) {
        return resEncode;
    }

    const dataJSON = JSON.stringify(payload);
    const textEnc = new TextEncoder();
    const data8b = textEnc.encode(dataJSON);

    const resBox = compatCrypto.boxRequest({
        message: data8b,
        // message: data,
        exitPeerId,
        uuid: id,
        exitPublicKey,
        counterOffset,
    });
    if (compatCrypto.isError(resBox)) {
        return Res.err(resBox.error);
    }

    return Res.ok({
        request: {
            id,
            originalId,
            provider,
            req,
            entryPeerId,
            exitPeerId,
            exitPublicKey,
            headers,
            hops,
            measureRPClatency,
            reqRelayPeerId,
            respRelayPeerId,
            startedAt: performance.now(),
        },
        session: resBox.session,
    });
}

export function messageToReq({
    message,
    requestId,
    exitPeerId,
    exitPrivateKey,
}: {
    requestId: string;
    message: Uint8Array;
    exitPeerId: string;
    exitPrivateKey: Uint8Array;
}): Res.Result<UnboxRequest> {
    const resUnbox = compatCrypto.unboxRequest({
        message,
        uuid: requestId,
        exitPeerId,
        exitPrivateKey,
    });
    if (compatCrypto.isError(resUnbox)) {
        return Res.err(resUnbox.error);
    }

    if (!resUnbox.session.request) {
        return Res.err('Crypto session without request object');
    }

    const msg = Utils.bytesToString(resUnbox.session.request);
    try {
        const reqPayload = JSON.parse(msg);
        return Res.ok({
            reqPayload,
            session: resUnbox.session,
        });
    } catch (ex: any) {
        return Res.err(`Error during JSON parsing: ${ex.toString()}`);
    }
}

/**
 * Convert request to segments.
 */
export function toSegments(req: Request, session: compatCrypto.Session): Segment.Segment[] {
    // we need the entry id ouside of of the actual encrypted payload
    const reqData = session.request as Uint8Array;
    const pIdBytes = Utils.stringToBytes(req.entryPeerId);
    const body = new Uint8Array(pIdBytes.length + reqData.length);
    body.set(pIdBytes);
    body.set(reqData, pIdBytes.length);
    return Segment.toSegments(req.id, body);
}

/**
 * Pretty print request in human readable form.
 */
export function prettyPrint(req: Request) {
    const eId = Utils.shortPeerId(req.entryPeerId);
    const xId = Utils.shortPeerId(req.exitPeerId);
    const path = [`e${eId}`];
    if (req.reqRelayPeerId) {
        path.push(`r${Utils.shortPeerId(req.reqRelayPeerId)}`);
    } else if (req.hops !== 0) {
        path.push('(r)');
    }
    path.push(`x${xId}`);
    if (req.respRelayPeerId) {
        path.push(`r${Utils.shortPeerId(req.respRelayPeerId)}`);
    }
    const id = req.id;
    const prov = req.provider;
    return `request[${id}, ${path.join('>')}, ${prov}]`;
}
