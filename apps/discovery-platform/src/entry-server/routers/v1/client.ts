import type { Pool } from "pg";
import type { Request, Response } from "express";
import { ParamSchema } from "express-validator";

import * as client from "../../../client";
import * as q from "../../../query";
import { createLogger } from "../../../utils";

const log = createLogger(["router", "client"]);

export const createSchema: Record<keyof client.CreateAttrs, ParamSchema> = {
  invalidatedAt: {
    in: "body",
    isDate: true,
    optional: true,
  },
};

export const updateSchema: Record<keyof client.CreateAttrs, ParamSchema> = {
  invalidatedAt: {
    in: "body",
    isDate: true,
  },
};

export function index(dbPool: Pool) {
  return function (req: Request, res: Response) {
    const userId = (req.user as q.User).id;
    client
      .listByUserId(dbPool, userId)
      .then((qRes) =>
        res.status(200).json({
          entries: qRes.rows.map(client.mapFromDB),
          count: qRes.rowCount,
        })
      )
      .catch((err) => {
        log.error("Error during client listByUserId query", err);
        res.status(500).end();
      });
  };
}

export function create(dbPool: Pool) {
  return function (req: Request, res: Response) {
    const userId = (req.user as q.User).id;
    client
      .create(dbPool, userId, req.body)
      .then((qRes) => {
        res.status(201).json(client.mapFromDB(qRes.rows[0]));
      })
      .catch((err) => {
        log.error("Error during client create query", err);
        res.status(500).end();
      });
  };
}

export function del(dbPool: Pool) {
  return function (req: Request, res: Response) {
    const userId = (req.user as q.User).id;
    client
      .del(dbPool, userId, req.params[0])
      .then((_qRes) => {
        res.status(204).end();
      })
      .catch((err) => {
        log.error("Error during client delete query", err);
        res.status(500).end();
      });
  };
}

export function read(dbPool: Pool) {
  return function (req: Request, res: Response) {
    const userId = (req.user as q.User).id;
    client
      .read(dbPool, userId, req.params[0])
      .then((qRes) => {
        res.status(200).json(client.mapFromDB(qRes.rows[0]));
      })
      .catch((err) => {
        log.error("Error during client read query", err);
        res.status(500).end();
      });
  };
}

export function update(dbPool: Pool) {
  return function (req: Request, res: Response) {
    const userId = (req.user as q.User).id;
    client
      .update(dbPool, userId, req.params[0], req.body)
      .then((qRes) => {
        res.status(200).json(client.mapFromDB(qRes.rows[0]));
      })
      .catch((err) => {
        log.error("Error during client update query", err);
        res.status(500).end();
      });
  };
}
