import { utils } from "ethers";
import type {
  Envelope,
  box_request,
  unbox_request,
  Session,
  Identity,
} from "@rpch/crypto-for-nodejs";

import * as JRPC from "./jrpc";
import * as Payload from "./payload";
import * as Segment from "./segment";
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

export type ReqSuccess = {
  success: true;
  req: Payload.ReqPayload;
  session: Session;
  counter: bigint;
};
export type ReqError = { success: false; error: string };
export type Req = ReqSuccess | ReqError;

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
    requestId: id,
    req,
  });

  // Envelop only needs the target node id - see usages
  const envelope = new crypto.Envelope(payload, exitId, exitId);
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

export function messageToReq({
  crypto,
  counter,
  hexData,
  exitId,
  exitNodeWriteIdentity,
}: {
  hexData: string;
  exitId: string;
  exitNodeWriteIdentity: Identity;
  counter: bigint;
  crypto: { Envelope: typeof Envelope; unbox_request: typeof unbox_request };
}): Req {
  // Envelop only needs the target node id - see usages
  const envelope = new crypto.Envelope(utils.arrayify(hexData), exitId, exitId);

  let session;
  try {
    session = crypto.unbox_request(envelope, exitNodeWriteIdentity, counter);
  } catch (err) {
    return { success: false, error: `unboxing request failed: ${err}` };
  }

  const data = session.get_request_data();
  const req = Payload.decodeReq(data);
  const newCount = session.updated_counter();
  return {
    success: true,
    req,
    session: session,
    counter: newCount,
  };
}

/**
 * Convert request to segments.
 */
export function toSegments(req: Request): Segment.Segment[] {
  // we need the entry id ouside of of the actual encrypted payload
  const hexData = utils.hexlify(req.session.get_request_data());
  const body = `${req.entryId}|${hexData}`;
  return Segment.toSegments(req.id, body);
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

export function reqSuccess(res: Req): res is ReqSuccess {
  return res.success;
}
