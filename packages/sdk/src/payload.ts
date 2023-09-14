import * as msgPack from "@msgpack/msgpack";
import * as JRPC from "./jrpc";

export type ReqPayload = {
  provider: string;
  clientId: string;
  req: JRPC.Request;
};

export function encodeReq(payload: ReqPayload): Uint8Array {
  return msgPack.encode(payload);
}

export function decodeReq(payload: Uint8Array): ReqPayload {
  return msgPack.decode(payload) as ReqPayload;
}

export function encodeResp(payload: JRPC.Response): Uint8Array {
  return msgPack.encode(payload);
}

export function decodeResp(payload: Uint8Array): JRPC.Response {
  return msgPack.decode(payload) as JRPC.Response;
}
