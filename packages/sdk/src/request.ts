import { utils } from "ethers";
import { compression } from "@rpch/common";
import type {
  Envelope,
  box_request,
  Session,
  Identity,
} from "@rpch/crypto-for-nodejs";
import type { Segment } from "./segment";

export type RequestData = {
  provider: string;
  body: string;
  createdAt: number;
  entryId: string; // peerID
  exitId: string; // peerID
  exitNodeReadIdentity: Identity;
  session: Session;
};

export interface Request extends RequestData {
  id: number;
}

// Maximum bytes we should be sending within the HOPR network.
const MAX_BYTES = 400;
// Maximum segment overhead is 17 bytes, could be as little as 13 though (e.g. `4|999999|999|999|` vs `4|999999|9|9|`)
const MAX_SEGMENT_BODY = MAX_BYTES - 17;

/**
 * Creates a request without the id.
 * It holds all request data but will need to get an id from requestCache.
 */
export function create(
  crypto: {
    Envelope: typeof Envelope;
    box_request: typeof box_request;
  },
  provider: string,
  body: string,
  entryId: string,
  exitId: string,
  exitNodeReadIdentity: Identity
): RequestData {
  const compressedBody = compression.compressRpcRequest(body);
  const payload = [3, "request", provider, compressedBody].join("|");
  const envelope = new crypto.Envelope(
    utils.toUtf8Bytes(payload),
    entryId,
    exitId
  );
  const session = crypto.box_request(envelope, exitNodeReadIdentity);
  return {
    provider,
    body,
    createdAt: Date.now(),
    entryId,
    exitId,
    exitNodeReadIdentity,
    session,
  };
}

export function toSegments(req: Request): Segment[] {
  const body = [
    2,
    req.entryId,
    utils.hexlify(req.session.get_request_data()),
  ].join("|");

  const chunks: string[] = [];
  for (let i = 0; i < body.length; i += MAX_SEGMENT_BODY) {
    chunks.push(body.slice(i, i + MAX_SEGMENT_BODY));
  }

  return chunks.map((c, nr) => ({
    requestId: req.id,
    nr,
    totalCount: chunks.length,
    body: c,
  }));
}
