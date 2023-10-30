import * as crypto from '@rpch/compat-crypto';
import { utils } from 'ethers';

import * as Payload from './payload';
import * as JRPC from './jrpc';
import type { Request } from './request';

export type Response = {
    status: number;
    text: () => Promise<string>;
    json: () => Promise<JRPC.Response>;
};

export type RespSuccess = {
    res: 'success';
    resp: Payload.RespPayload;
    counter: bigint;
};
export type RespCounterFail = {
    res: 'counterfail';
    counter: bigint;
};
export type RespError = { res: 'error'; reason: string };
export type Resp = RespSuccess | RespCounterFail | RespError;

export type MsgSuccess = {
    success: true;
    hexData: string;
    newCount: bigint;
};
export type MsgError = { success: false; error: string };
export type Msg = MsgSuccess | MsgError;

export function respToMessage({
    entryPeerId,
    respPayload,
    unboxSession,
}: {
    entryPeerId: string;
    respPayload: Payload.RespPayload;
    unboxSession: crypto.Session;
}): Msg {
    const payload = Payload.encodeResp(respPayload);
    const data = utils.toUtf8Bytes(payload);
    const res = crypto.boxResponse(unboxSession, {
        entryPeerId,
        message: data,
    });
    if (crypto.isError(res)) {
        return { success: false, error: res.error };
    }
    if (!unboxSession.response) {
        return { success: false, error: 'crypto session without response object' };
    }
    const hexData = utils.hexlify(unboxSession.response);
    const newCount = unboxSession.updatedTS;
    return { success: true, hexData, newCount };
}

export function messageToResp({
    respData,
    request,
    counter,
}: {
    respData: Uint8Array;
    request: Request;
    counter: bigint;
}): Resp {
    const res = crypto.unboxResponse(
        request.session,
        { message: respData, entryPeerId: request.entryPeerId },
        counter,
    );
    switch (res.res) {
        case crypto.ResState.Failed:
            return { res: 'error', reason: res.error };
        case crypto.ResState.OkFailedCounter:
            return {
                res: 'counterfail',
                counter: res.session.updatedTS,
            };
        case crypto.ResState.Ok:
        default: {
            if (!res.session.response) {
                return {
                    res: 'error',
                    reason: 'crypto session without response object',
                };
            }
            const msg = utils.toUtf8String(res.session.response);
            const resp = Payload.decodeResp(msg);
            const newCount = request.session.updatedTS;
            return {
                res: 'success',
                resp,
                counter: newCount,
            };
        }
    }
}

export function msgSuccess(res: Msg): res is MsgSuccess {
    return res.success;
}

export function respSuccess(res: Resp): res is RespSuccess {
    return res.res === 'success';
}
