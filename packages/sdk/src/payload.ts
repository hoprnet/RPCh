import LZString from 'lz-string';
import * as Res from './result';

export type ReqPayload = {
    cId: string; // client identifier
    ep: string; // http endpoint url, target of the request
    b?: string; // request body
    h?: Record<string, string>; // request headers, if left empty:  { 'Content-Type': 'application/json' }
    m?: string; // request method, if left empty: get
    // dev/debug params
    hops?: number; // defaults to 1
    relayPeerId?: string; // default to autorouting
    wDur?: boolean; // request duration
};

export enum RespType {
    Resp,
    CounterFail,
    DuplicateFail,
    Error,
}

export type RespPayload =
    | {
          t: RespType.Resp;
          s: number; // HTTP status
          x?: string; // response text
          rDur?: number;
          eDur?: number;
      }
    | {
          t: RespType.CounterFail;
          c: number; // current timestamp on exit node
      }
    | {
          t: RespType.DuplicateFail;
      }
    | {
          t: RespType.Error;
          r: string; // reason, describing the problem
      };

export type InfoPayload = {
    i: string; // peerId
    v: string; // version
    c: number; // current timestamp on node
    // dev/debug params
    shRelays?: string[]; // shortIds of relays
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

export function encodeInfo(payload: InfoPayload): Res.Result<string> {
    try {
        const res = LZString.compressToUTF16(JSON.stringify(payload));
        return Res.ok(res);
    } catch (ex) {
        return Res.err(`Error encoding info payload: ${ex}`);
    }
}

export function decodeInfo(payload: string): Res.Result<InfoPayload> {
    try {
        const res = JSON.parse(LZString.decompressFromUTF16(payload));
        return Res.ok(res);
    } catch (ex) {
        return Res.err(`Error decoding info payload: ${ex}`);
    }
}
