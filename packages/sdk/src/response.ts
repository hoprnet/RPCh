import type { Request } from "./request";
import { compression } from "@rpch/common";
import { utils } from "ethers";
import { unbox_response, Envelope } from "@rpch/crypto-for-nodejs";

export function messageToBody(
  msg: string,
  request: Request,
  counter: bigint,
  crypto: {
    unbox_response: typeof unbox_response;
    Envelope: typeof Envelope;
  }
):
  | { success: true; body: string; counter: bigint }
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

  const decrypted = utils.toUtf8String(request.session.get_response_data());
  const parts = decrypted.split("|");
  if (parts.length === 0) {
    return { success: false, error: "empty response body" };
  }

  const count = parseInt(parts[0], 10);
  if (count !== 2) {
    return { success: false, error: `invalid response parts: ${count}` };
  }

  const type = parts[1];
  if (type !== "response") {
    return { success: false, error: `wrong response type ${type}` };
  }
  const compressedDecrypted = parts[2];
  const decompressedDecrypted =
    compression.decompressRpcRequest(compressedDecrypted);
  const newCount = request.session.updated_counter();
  return {
    success: true,
    body: decompressedDecrypted,
    counter: newCount,
  };
}
