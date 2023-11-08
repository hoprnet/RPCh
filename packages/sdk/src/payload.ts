import LZString from 'lz-string';
import * as JRPC from './jrpc';
import * as Res from './result';

export type ReqPayload = {
    clientId: string;
    provider: string;
    req: JRPC.Request;
    headers?: Record<string, string>;
    hops?: number;
};

export enum RespType {
    Resp,
    CounterFail,
    DuplicateFail,
    HttpError,
    Error,
}
export type RespPayload =
    | {
          type: RespType.Resp;
          resp: JRPC.Response;
      }
    | {
          type: RespType.CounterFail;
          now: number;
      }
    | {
          type: RespType.DuplicateFail;
      }
    | {
          type: RespType.HttpError;
          status: number;
          text: string;
      }
    | {
          type: RespType.Error;
          reason: string;
      };

export function encodeReq(payload: ReqPayload): Res.ResultStr<string> {
    try {
        const res = LZString.compressToUTF16(JSON.stringify(payload));
        return Res.ok(res);
    } catch (ex) {
        return Res.err(`Error encoding request payload: ${ex}`);
    }
}

export function decodeReq(payload: string): Res.ResultStr<ReqPayload> {
    try {
        const res = JSON.parse(LZString.decompressFromUTF16(payload));
        return Res.ok(res);
    } catch (ex) {
        return Res.err(`Error decoding request payload: ${ex}`);
    }
}

export function encodeResp(payload: RespPayload): Res.ResultStr<string> {
    try {
        const res = LZString.compressToUTF16(JSON.stringify(payload));
        return Res.ok(res);
    } catch (ex) {
        return Res.err(`Error encoding response payload: ${ex}`);
    }
}

export function decodeResp(payload: string): Res.ResultStr<RespPayload> {
    try {
        const res = JSON.parse(LZString.decompressFromUTF16(payload));
        return Res.ok(res);
    } catch (ex) {
        return Res.err(`Error decoding response payload: ${ex}`);
    }
}
