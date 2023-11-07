import LZString from 'lz-string';
import * as JRPC from './jrpc';
import * as Res from './result';

export type ReqPayload = {
    clientId: string;
    provider: string;
    req: JRPC.Request;
    headers?: Record<string, string>;
    hops?: number;
    id: string;
};

export type RespPayload =
    | {
          type: 'resp';
          resp: JRPC.Response;
      }
    | {
          type: 'counterfail';
          counter: number;
          now: number;
      }
    | {
          type: 'duplicatefail';
          id: string;
      }
    | {
          type: 'httperror';
          status: number;
          text: string;
      }
    | {
          type: 'error';
          reason: string;
      };

export function encodeReq(payload: ReqPayload): Res.Result<string> {
    try {
        const res = LZString.compressToUTF16(JSON.stringify(payload));
        return Res.ok(res);
    } catch (ex) {
        return Res.err(`Error encoding request payload: ${ex}`);
    }
}

export function decodeReq(payload: string): Res.Result<ReqPayload> {
    try {
        const res = JSON.parse(LZString.decompressFromUTF16(payload));
        return Res.ok(res);
    } catch (ex) {
        return Res.err(`Error decoding request payload: ${ex}`);
    }
}

export function encodeResp(payload: RespPayload): Res.Result<string> {
    try {
        const res = LZString.compressToUTF16(JSON.stringify(payload));
        return Res.ok(res);
    } catch (ex) {
        return Res.err(`Error encoding response payload: ${ex}`);
    }
}

export function decodeResp(payload: string): Res.Result<RespPayload> {
    try {
        const res = JSON.parse(LZString.decompressFromUTF16(payload));
        return Res.ok(res);
    } catch (ex) {
        return Res.err(`Error decoding response payload: ${ex}`);
    }
}
