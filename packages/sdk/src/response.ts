import { utils } from "ethers";
import { unbox_response, Envelope } from "@rpch/crypto-for-nodejs";

import * as JRPC from "./jrpc";
import * as Payload from "./payload";
import type { Request } from "./request";

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
  | { success: true; resp: JRPC.Response; counter: bigint }
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
