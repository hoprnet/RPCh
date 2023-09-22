import type { Pool } from "pg";
import type { Request, Response } from "express";
import { ParamSchema } from "express-validator";

import * as node from "../../../node";
import { createLogger } from "../../../utils";

const log = createLogger(["router", "node"]);

export const createSchema: Record<keyof node.NodeAttrs, ParamSchema> = {
  id: {
    in: "body",
    exists: {
      errorMessage: "Expected peerId to be in the body",
      bail: true,
    },
    isString: true,
  },
  chainId: {
    in: "body",
    exists: {
      errorMessage: "Expected chainId to be in the body",
      bail: true,
    },
    isNumeric: true,
    toInt: true,
  },
  isExitNode: {
    in: "body",
    exists: {
      errorMessage: "Expected isExitNode to be in the body",
      bail: true,
    },
    isBoolean: true,
    toBoolean: true,
  },
  hoprdApiEndpoint: {
    in: "body",
    exists: {
      errorMessage: "Expected hoprdApiEndpoint to be in the body",
      bail: true,
    },
    isString: true,
  },
  hoprdApiToken: {
    in: "body",
    exists: {
      errorMessage: "Expected hoprdApiToken to be in the body",
      bail: true,
    },
    isString: true,
  },
  nativeAddress: {
    in: "body",
    exists: {
      errorMessage: "Expected nativeAddress to be in the body",
      bail: true,
    },
    isString: true,
  },
  exitNodePubKey: {
    in: "body",
    isString: true,
  },
};

export function create(dbPool: Pool) {
  return function (req: Request, res: Response) {
    if (req.body.isExitNode && !req.body.exitNodePubKey) {
      return res
        .status(400)
        .json({ errors: { exitNodePubKey: "missing on exit node" } });
    }

    node
      .createNode(dbPool, req.body)
      .then((_qRes) => {
        node
          .createToken(dbPool, req.body.id)
          .then((qRes) => {
            res.status(201).json(node.partialTokenFromDB(qRes.rows[0]));
          })
          .catch((err) => {
            log.error("Error during token create query", err);
            res.status(500).end();
          });
      })
      .catch((err) => {
        log.error("Error during node create query", err);
        res.status(500).end();
      });
  };
}
