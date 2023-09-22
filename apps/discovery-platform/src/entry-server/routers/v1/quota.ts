import type { Pool } from "pg";
import type { Request, Response } from "express";
import { ParamSchema } from "express-validator";

import * as quota from "../../../quota";
import { createLogger } from "../../../utils";

const log = createLogger(["router", "quota"]);

export type ReqNodeAuthed = Request & { nodeId: string };

export const schema: Record<keyof quota.Attrs, ParamSchema> = {
  clientId: {
    in: "body",
    exists: {
      errorMessage: "Expected clientId in body",
      bail: true,
    },
    isString: true,
  },
  segmentCount: {
    in: "body",
    exists: {
      errorMessage: "Expected segmentCount in body",
      bail: true,
    },
    isInt: true,
    toInt: true,
  },
  rpcMethod: {
    in: "body",
    isString: true,
  },
};

export function request(dbPool: Pool) {
  return function (req: Request, res: Response) {
    console.log("req", req);
    if ("exitId" in req) {
      console.log("barf", req.exitId);
    }
    // TODO
    return res.status(200).end();
    /*
    quota
      .createRequest(dbPool, req.nodeId, req.body)
      .then(() => {
        res.status(204).end();
      })
      .catch((err) => {
        log.error("Error during create request quota query", err);
        res.status(500).end();
      });
  */
  };
}

export function response(dbPool: Pool) {
  return function (req: Request, res: Response) {
    // TODO
    return res.status(200).end();
    /*
    quota
      .createResponse(dbPool, req.nodeId, req.body)
      .then(() => {
        res.status(204).end();
      })
      .catch((err) => {
        log.error("Error during create response quota query", err);
        res.status(500).end();
      });
  */
  };
}
