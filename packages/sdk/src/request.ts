import { utils } from "ethers";
import type {
  Envelope,
  box_request,
  Session,
  Identity,
} from "@rpch/crypto-for-nodejs";

import * as JRPC from "./jrpc";
import * as Payload from "./payload";
import type { Segment } from "./segment";
import { shortPeerId } from "./utils";

export type Request = {
  id: number;
  originalId?: number;
  provider: string;
  req: JRPC.Request;
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
export function create({
  crypto,
  id,
  provider,
  req,
  clientId,
  entryId,
  exitId,
  exitNodeReadIdentity,
}: {
  crypto: {
    Envelope: typeof Envelope;
    box_request: typeof box_request;
  };
  id: number;
  provider: string;
  req: JRPC.Request;
  clientId: string;
  entryId: string;
  exitId: string;
  exitNodeReadIdentity: Identity;
}): Request {
  const payload = Payload.encodeReq({
    provider,
    clientId,
    req,
  });

  const envelope = new crypto.Envelope(payload, entryId, exitId);
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
export function prettyPrint(req: Request) {
  const eId = shortPeerId(req.entryId);
  const xId = shortPeerId(req.exitId);
  const prov = req.provider.substring(0, 14);
  return `request[id: ${req.id}, entryId: ${eId}, exitId: ${xId}, prov: ${prov}.. ]`;
}
