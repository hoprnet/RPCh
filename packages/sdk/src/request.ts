import { utils } from "ethers";
import { compression } from "@rpch/common";
import type {
  Envelope,
  box_request,
  Session,
  Identity,
} from "@rpch/crypto-for-nodejs";

export type RequestData = {
  provider: string;
  body: string;
  createdAt: number;
  entryId: string; // peerID
  exitId: string; // peerID
  exitNodeReadIdentity: Identity;
  session: Session;
};

export type Request = RequestData & {
  id: number;
  resolve: (body: string) => void;
  reject: (error: string) => void;
};

/**
 * Maximum bytes we should be sending
 * within the HOPR network.
 */
const MAX_BYTES = 400;

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
