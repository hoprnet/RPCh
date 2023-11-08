import * as compatCrypto from '@rpch/compat-crypto';
import { utils } from 'ethers';

import * as JRPC from './jrpc';
import * as Payload from './payload';
import * as Res from './result';
import type { Request } from './request';

export type Response = {
    status: number;
    text: () => Promise<string>;
    json: () => Promise<JRPC.Response>;
};

export type UnboxResponse = {
    resp: Payload.RespPayload;
    session: compatCrypto.Session;
};

export function respToMessage({
    entryPeerId,
    respPayload,
    unboxSession,
}: {
    entryPeerId: string;
    respPayload: Payload.RespPayload;
    unboxSession: compatCrypto.Session;
}): Res.ResultStr<string> {
    const resEncode = Payload.encodeResp(respPayload);
    if (Res.isErr(resEncode)) {
        return resEncode;
    }

    const data = utils.toUtf8Bytes(resEncode.res);
    const resBox = compatCrypto.boxResponse(unboxSession, {
        entryPeerId,
        message: data,
    });
    if (compatCrypto.isError(resBox)) {
        return Res.err(resBox.error);
    }

    if (!resBox.session.response) {
        return Res.err('Crypto session without response object');
    }

    const hexData = utils.hexlify(resBox.session.response);
    return Res.ok(hexData);
}

export function messageToResp({
    respData,
    request,
    session,
}: {
    respData: Uint8Array;
    request: Request;
    session: compatCrypto.Session;
}): Res.ResultStr<UnboxResponse> {
    const resUnbox = compatCrypto.unboxResponse(session, {
        message: respData,
        entryPeerId: request.entryPeerId,
    });
    if (compatCrypto.isError(resUnbox)) {
        return Res.err(resUnbox.error);
    }

    if (!resUnbox.session.response) {
        return Res.err(`Crypto session without response object`);
    }

    const msg = utils.toUtf8String(resUnbox.session.response);
    const resDecode = Payload.decodeResp(msg);
    if (Res.isErr(resDecode)) {
        return resDecode;
    }

    return Res.ok({
        session: resUnbox.session,
        resp: resDecode.res,
    });
}
