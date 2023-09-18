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

export function respToMessage({
  crypto,
  entryId,
  requestId,
  resp,
  unboxSession,
}: {
  crypto: {
    Envelope: typeof Envelope;
    box_response: typeof box_response;
  };
  entryId: string;
  requestId: number;
  resp: JRPC.Response;
  unboxSession: Session;
}) {
  const payload = Payload.encodeResp({
    requestId,
    resp,
  });

  // Envelop only needs the target node id - see usages
  const envelope = new crypto.Envelope(payload, entryId, entryId);
  try {
    crypto.box_response(unboxSession, envelope);
  } catch (err) {
    return { success: false, error: `boxing response failed: ${err}` };
  }

  const hexResp = utils.hexlify(unboxSession.get_response_data());
  const newCount = unboxSession.updated_counter();
  return { success: true, hexResp, newCount };
}

export function messageToResp({
  msg,
  request,
  counter,
  crypto,
}: {
  msg: string;
  request: Request;
  counter: bigint;
  crypto: {
    unbox_response: typeof unbox_response;
    Envelope: typeof Envelope;
  };
}):
  | { success: true; resp: Payload.RespPayload; counter: bigint }
  | { success: false; error: string } {
  try {
    crypto.unbox_response(
      request.session,
      new crypto.Envelope(utils.arrayify(msg), request.entryId, request.exitId),
      counter
    );
  } catch (err) {
    return { success: false, error: `unboxing response failed: ${err}` };
  }

  const resp = Payload.decodeResp(request.session.get_response_data());
  const newCount = request.session.updated_counter();
  return {
    success: true,
    resp,
    counter: newCount,
  };
}
