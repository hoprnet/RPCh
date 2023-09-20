import { Encoder, Decoder } from "@msgpack/msgpack";
import * as JRPC from "./jrpc";

export type ReqPayload = {
  provider: string;
  clientId: string;
  req: JRPC.Request;
};

export type RespPayload = {
  resp: JRPC.Response;
};

// see https://github.com/msgpack/msgpack-javascript#reusing-encoder-and-decoder-instances
const encoder = new Encoder();
const decoder = new Decoder();

export function encodeReq(payload: ReqPayload): Uint8Array {
  return encoder.encode(payload);
}

export function decodeReq(payload: Uint8Array): ReqPayload {
  return decoder.decode(payload) as ReqPayload;
}

export function encodeResp(payload: RespPayload): Uint8Array {
  return encoder.encode(payload);
}

export function decodeResp(payload: Uint8Array): RespPayload {
  return decoder.decode(payload) as RespPayload;
}
