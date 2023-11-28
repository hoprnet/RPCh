import * as compatCrypto from '@rpch/compat-crypto';
import { utils } from 'ethers';

import * as Res from './result';
import * as JRPC from './jrpc';
import * as Payload from './payload';
import * as Segment from './segment';
import { shortPeerId } from './utils';

export type Request = {
    id: string; // uuid
    originalId?: string;
    provider: string;
    req: JRPC.Request;
    createdAt: number;
    entryPeerId: string;
    exitPeerId: string;
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
    headers?: Record<string, string>;
    hops?: number;
    reqRelayPeerId?: string;
    respRelayPeerId?: string;
}): Res.Result<{ request: Request; session: compatCrypto.Session }> {
    const resEncode = Payload.encodeReq({
        provider,
        clientId,
        req,
        headers,
        hops,
        relayPeerId: respRelayPeerId,
    });
    if (Res.isErr(resEncode)) {
        return resEncode;
    }

    const data = utils.toUtf8Bytes(resEncode.res);
    const resBox = compatCrypto.boxRequest({
        message: data,
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
            createdAt: Date.now(),
            entryPeerId,
            exitPeerId,
            exitPublicKey,
            headers,
            hops,
            reqRelayPeerId,
            respRelayPeerId,
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

    const msg = utils.toUtf8String(resUnbox.session.request);
    const resDecode = Payload.decodeReq(msg);
    if (Res.isErr(resDecode)) {
        return resDecode;
    }

    return Res.ok({
        reqPayload: resDecode.res,
        session: resUnbox.session,
    });
}

/**
 * Convert request to segments.
 */
export function toSegments(req: Request, session: compatCrypto.Session): Segment.Segment[] {
    // we need the entry id ouside of of the actual encrypted payload
    const entryIdData = utils.toUtf8Bytes(req.entryPeerId);
    const reqData = session.request!;
    const hexEntryId = utils.hexlify(entryIdData);
    const hexData = utils.hexlify(reqData);
    const body = `${hexEntryId},${hexData}`;
    return Segment.toSegments(req.id, body);
}

/**
 * Pretty print request in human readable form.
 */
export function prettyPrint(req: Request) {
    const eId = shortPeerId(req.entryPeerId);
    const xId = shortPeerId(req.exitPeerId);
    const path = [`e${eId}`];
    if (req.reqRelayPeerId) {
        path.push(`r${shortPeerId(req.reqRelayPeerId)}`);
    } else if (req.hops !== 0) {
        path.push('(r)');
    }
    path.push(`x${xId}`);
    if (req.respRelayPeerId) {
        path.push(`r${shortPeerId(req.respRelayPeerId)}`);
    }
    const id = req.id;
    const prov = req.provider;
    return `request[${id}, ${path.join('>')}, ${prov}]`;
}
