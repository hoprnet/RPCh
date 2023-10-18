import * as crypto from "@rpch/compat-crypto";
import { utils } from "ethers";

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
  entryPeerId: string;
  exitPeerId: string;
  exitPublicKey: Uint8Array;
  session: crypto.Session;
};

export type ReqSuccess = {
  res: "success";
  req: Payload.ReqPayload;
  session: crypto.Session;
  counter: Date;
};
export type ReqCounterFail = {
  res: "counterfail";
  req: Payload.ReqPayload;
  session: crypto.Session;
};
export type ReqError = { res: "error"; reason: string };
export type Req = ReqSuccess | ReqCounterFail | ReqError;

/**
 * Creates a request and compresses its payload.
 */
export function create({
  id,
  provider,
  req,
  clientId,
  entryPeerId,
  exitPeerId,
  exitPublicKey,
  headers,
}: {
  id: number;
  provider: string;
  req: JRPC.Request;
  clientId: string;
  entryPeerId: string;
  exitPeerId: string;
  exitPublicKey: Uint8Array;
  headers?: Record<string, string>;
}): { success: true; req: Request } | { success: false; error: string } {
  const payload = Payload.encodeReq({
    provider,
    clientId,
    req,
    headers,
  });
  const data = utils.toUtf8Bytes(payload);
  const res = crypto.boxRequest({
    message: data,
    exitPeerId,
    exitPublicKey,
  });
  if (crypto.isError(res)) {
    return { success: false, error: res.error };
  }

  return {
    success: true,
    req: {
      id,
      provider,
      req,
      createdAt: Date.now(),
      entryPeerId,
      exitPeerId,
      exitPublicKey,
      session: res.session,
    },
  };
}

export function messageToReq({
  counter,
  message,
  exitPeerId,
  exitPrivateKey,
}: {
  message: Uint8Array;
  exitPeerId: string;
  exitPrivateKey: Uint8Array;
  counter: Date;
}): Req {
  const res = crypto.unboxRequest(
    { message, exitPeerId, exitPrivateKey },
    counter
  );
  if (res.res === crypto.ResState.Failed) {
    return {
      res: "error",
      reason: res.error,
    };
  }

  if (!res.session.request) {
    return {
      res: "error",
      reason: "crypto session without request object",
    };
  }

  const msg = utils.toUtf8String(res.session.request);
  const req = Payload.decodeReq(msg);
  if (res.res === crypto.ResState.OkFailedCounter) {
    return {
      res: "counterfail",
      req,
      session: res.session,
    };
  }

  const newCount = res.session.updatedTS;
  return {
    res: "success",
    req,
    session: res.session,
    counter: newCount,
  };
}

/**
 * Convert request to segments.
 */
export function toSegments(req: Request): Segment.Segment[] {
  // we need the entry id ouside of of the actual encrypted payload
  const entryIdData = utils.toUtf8Bytes(req.entryPeerId);
  const reqData = req.session.request!;
  const hexEntryId = utils.hexlify(entryIdData);
  const hexData = utils.hexlify(reqData);
  const body = `${hexEntryId},${hexData}`;
  return Segment.toSegments(req.id, body);
}

/**
 * Pretty print request in human readable form.
 */
export function prettyPrint(req: Request, id?: string) {
  const eId = shortPeerId(req.entryPeerId);
  const xId = shortPeerId(req.exitPeerId);
  const prov = req.provider.substring(0, 14);
  const attrs = [req.id, `${eId}>${xId}`];
  if (id) {
    attrs.push(id);
  }
  attrs.push(prov);
  return `req[${attrs.join(",")}]`;
}

export function reqSuccess(res: Req): res is ReqSuccess {
  return res.res === "success";
}
