import { utils } from "ethers";
import {
  box_response,
  unbox_response,
  Envelope,
  Session,
} from "@rpch/crypto-for-nodejs";

import * as JRPC from "./jrpc";
import * as Payload from "./payload";
import type { Request } from "./request";

export type RespSuccess = {
  success: true;
  resp: Payload.RespPayload;
  counter: bigint;
};
export type RespError = { success: false; error: string };
export type Resp = RespSuccess | RespError;

export type MsgSuccess = {
  success: true;
  hexData: string;
  newCount: bigint;
};
export type MsgError = { success: false; error: string };
export type Msg = MsgSuccess | MsgError;

export function respToMessage({
  crypto,
  entryId,
  resp,
  unboxSession,
}: {
  crypto: {
    Envelope: typeof Envelope;
    box_response: typeof box_response;
  };
  entryId: string;
  resp: JRPC.Response;
  unboxSession: Session;
}): Msg {
  const payload = Payload.encodeResp({ resp });
  const data = utils.toUtf8Bytes(payload);

  // Envelop only needs the target node id - see usages
  const envelope = new crypto.Envelope(data, entryId, entryId);
  try {
    crypto.box_response(unboxSession, envelope);
  } catch (err) {
    return { success: false, error: `boxing response failed: ${err}` };
  }

  const hexData = utils.hexlify(unboxSession.get_response_data());
  const newCount = unboxSession.updated_counter();
  return { success: true, hexData, newCount };
}

export function messageToResp({
  respData,
  request,
  counter,
  crypto,
}: {
  respData: Uint8Array;
  request: Request;
  counter: bigint;
  crypto: {
    unbox_response: typeof unbox_response;
    Envelope: typeof Envelope;
  };
}): Resp {
  try {
    crypto.unbox_response(
      request.session,
      new crypto.Envelope(respData, request.entryId, request.exitId),
      counter
    );
  } catch (err) {
    return { success: false, error: `unboxing response failed: ${err}` };
  }
  const data = request.session.get_response_data();
  const msg = utils.toUtf8String(data);
  const resp = Payload.decodeResp(msg);
  const newCount = request.session.updated_counter();
  return {
    success: true,
    resp,
    counter: newCount,
  };
}

export function msgSuccess(res: Msg): res is MsgSuccess {
  return res.success;
}

export function respSuccess(res: Resp): res is RespSuccess {
  return res.success;
}
