import * as msgPack from "@msgpack/msgpack";
import * as JRPC from "./jrpc";

export type ReqPayload = {
  provider: string;
  clientId: string;
  requestId: number;
  req: JRPC.Request;
};

export type RespPayload = {
  requestId: number;
  resp: JRPC.Response;
};

export function encodeReq(payload: ReqPayload): Uint8Array {
  return msgPack.encode(payload);
}

export function decodeReq(payload: Uint8Array): ReqPayload {
  return msgPack.decode(payload) as ReqPayload;
}

export function encodeResp(payload: RespPayload): Uint8Array {
  return msgPack.encode(payload);
}

export function decodeResp(payload: Uint8Array): RespPayload {
  return msgPack.decode(payload) as RespPayload;
}
