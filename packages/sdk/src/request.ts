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
};

export type UnboxRequest = {
    req: Payload.ReqPayload;
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
    headers,
    hops,
}: {
    id: string;
    originalId?: string;
    provider: string;
    req: JRPC.Request;
    clientId: string;
    entryPeerId: string;
    exitPeerId: string;
    exitPublicKey: Uint8Array;
    headers?: Record<string, string>;
    hops?: number;
}): Res.Result<{ request: Request; session: compatCrypto.Session }> {
    const resEncode = Payload.encodeReq({
        provider,
        clientId,
        req,
        headers,
        hops,
        id,
    });
    if (Res.isErr(resEncode)) {
        return resEncode;
    }

    const data = utils.toUtf8Bytes(resEncode.res);
    const resBox = compatCrypto.boxRequest({
        message: data,
        exitPeerId,
        exitPublicKey,
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
        },
        session: resBox.session,
    });
}

export function messageToReq({
    message,
    exitPeerId,
    exitPrivateKey,
}: {
    message: Uint8Array;
    exitPeerId: string;
    exitPrivateKey: Uint8Array;
}): Res.Result<UnboxRequest> {
    const resUnbox = compatCrypto.unboxRequest({ message, exitPeerId, exitPrivateKey });
    if (compatCrypto.isError(resUnbox)) {
        return Res.err(resUnbox.error);
    }

    if (!resUnbox.session.request) {
        return Res.err(`Crypto session without request object`);
    }

    const msg = utils.toUtf8String(resUnbox.session.request);
    const resDecode = Payload.decodeReq(msg);
    if (Res.isErr(resDecode)) {
        return resDecode;
    }

    return Res.ok({
        req: resDecode.res,
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
export function prettyPrint(req: Request, id?: string) {
    const eId = shortPeerId(req.entryPeerId);
    const xId = shortPeerId(req.exitPeerId);
    const prov = req.provider.substring(0, 14);
    const attrs = [req.id, `${eId}>${xId}`];
    if (id) {
        attrs.push(id);
    }
    attrs.push(prov);
    return `req[${attrs.join(',')}]`;
}
