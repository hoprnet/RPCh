import { utils } from "ethers";
import type {
  Envelope,
  box_request,
  Session,
  Identity,
} from "@rpch/crypto-for-nodejs";

import * as compression from "./compression";
import type { RPCrequest } from ".";
import type { Segment } from "./segment";
import { shortPeerId } from "./utils";

export type Request = {
  id: number;
  originalId?: number;
  provider: string;
  req: RPCrequest;
  createdAt: number;
  entryId: string; // peerID
  exitId: string; // peerID
  exitNodeReadIdentity: Identity;
  session: Session;
};

// Maximum bytes we should be sending within the HOPR network.
export const MaxBytes = 400;
// Maximum segment overhead is 17 bytes, could be as little as 13 though (e.g. `4|999999|999|999|` vs `4|999999|9|9|`)
const MaxSegmentBody = MaxBytes - 17;

/**
 * Creates a request and compresses its payload.
 */
export function create(
  crypto: {
    Envelope: typeof Envelope;
    box_request: typeof box_request;
  },
  id: number,
  provider: string,
  req: RPCrequest,
  entryId: string,
  exitId: string,
  exitNodeReadIdentity: Identity
): Request {
  // TODO use json instead of string here
  const compressedBody = compression.compressRpcRequest(JSON.stringify(req));
  const payload = [3, "request", provider, compressedBody].join("|");
  const envelope = new crypto.Envelope(
    utils.toUtf8Bytes(payload),
    entryId,
    exitId
  );
  const session = crypto.box_request(envelope, exitNodeReadIdentity);
  return {
    id,
    provider,
    req,
    createdAt: Date.now(),
    entryId,
    exitId,
    exitNodeReadIdentity,
    session,
  };
}

/**
 * Creates a request from original request message and provider and compresses its payload.
 */
export function fromOriginal(
  crypto: {
    Envelope: typeof Envelope;
    box_request: typeof box_request;
  },
  id: number,
  original: Request,
  entryId: string,
  exitId: string,
  exitNodeReadIdentity: Identity
) {
  // TODO use json instead of string here
  const compressedBody = compression.compressRpcRequest(
    JSON.stringify(original.req)
  );
  const payload = [3, "request", original.provider, compressedBody].join("|");
  const envelope = new crypto.Envelope(
    utils.toUtf8Bytes(payload),
    entryId,
    exitId
  );
  const session = crypto.box_request(envelope, exitNodeReadIdentity);
  return {
    id,
    originalId: original.id,
    provider: original.provider,
    req: original.req,
    createdAt: Date.now(),
    entryId,
    exitId,
    exitNodeReadIdentity,
    session,
  };
}

/**
 * Convert request to segments.
 */
export function toSegments(req: Request): Segment[] {
  const hexData = utils.hexlify(req.session.get_request_data());
  const body = [2, req.entryId, hexData].join("|");

  const chunks: string[] = [];
  for (let i = 0; i < body.length; i += MaxSegmentBody) {
    chunks.push(body.slice(i, i + MaxSegmentBody));
  }

  return chunks.map((c, nr) => ({
    requestId: req.id,
    nr,
    totalCount: chunks.length,
    body: c,
  }));
}

/**
 * Pretty print request in human readable form.
 */
export function prettyPrint({ id, entryId, exitId }: Request) {
  const eId = shortPeerId(entryId);
  const xId = shortPeerId(exitId);
  return `request[id: ${id}, entryId: ${eId}, exitId: ${xId}`;
}
