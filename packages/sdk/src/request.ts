import { utils } from "ethers";
import Compression from "@rpch/common";
import type {
  Envelope,
  box_request,
  Session,
  Identity,
} from "@rpch/crypto-for-nodejs";

import * as RequestCache from "./request-cache";

export type PartialRequest = {
  provider: string;
  body: string;
  entryNodeId: string; // peerID
  exitNodeId: string; // peerID
  exitNodeReadIdentity: Identity;
  session: Session;
};

export type Request = PartialRequest & { id: number };

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
  entryNodeId: string,
  exitNodeId: string,
  exitNodeReadIdentity: Identity
): PartialRequest {
  const compressedBody = Compression.compressRpcRequest(body);
  const payload = [3, "request", provider, compressedBody].join("|");
  const envelope = new crypto.Envelope(
    utils.toUtf8Bytes(payload),
    entryNodeId,
    exitNodeId
  );
  const session = crypto.box_request(envelope, exitNodeReadIdentity);
  return {
    provider,
    body,
    entryNodeId,
    exitNodeId,
    exitNodeReadIdentity,
    session,
  };
}

function generateId(requestCache: RequestCache.Cache) {
  let id = Math.floor(Math.random() * 1e6);
  while (requestCache.has(id)) {
    id = Math.floor(Math.random() * 1e6);
  }
  return id;
}
const id = generateId(requestCache);
requestCache.set(id, request);
return request;
