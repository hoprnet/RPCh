import { getClientQuotas, type DBInstance } from "../../../db";
import memoryCache from "memory-cache";

import { createLogger } from "../../../utils";
import * as dbClient from "../../../client";

import type { Pool } from "pg";
import type { NextFunction, Request, Response } from "express";
import type { Histogram } from "prom-client";

const log = createLogger(["entry-server", "router", "v1", "middleware"]);

export const getCache = <T>(
  constructKey: (req: Request) => string,
  modifyPayload: (body: T) => T
) => {
  return (req: Request, res: Response<any, any>, next: NextFunction) => {
    let key = constructKey(req);
    let cachedBody = memoryCache.get(key);
    if (cachedBody) {
      log.verbose("Returning cached value for endpoint: ", key);
      return res.json(modifyPayload(cachedBody));
    }
    next();
  };
};

export const setCache = (key: string, duration: number, body: Object) => {
  memoryCache.put(key, body, duration);
};

// middleware used to check if client sent in req has enough quota
export const doesClientHaveQuota = async (
  db: DBInstance,
  client: string,
  baseQuota: bigint
) => {
  const { sum } = await getClientQuotas(db, client);
  return sum >= baseQuota;
};

export function clientAuthorized(dbPool: Pool) {
  return async function (req: Request, res: Response, next: NextFunction) {
    const clientId = req.headers["x-rpch-client"] as string;
    const result = await dbClient
      .listIdsByExternalToken(dbPool, clientId)
      .catch((ex) => log.error("Error reading clientIds", ex));
    const count = result?.rowCount || 0;
    if (count > 0) {
      next();
    } else {
      const reason = "Client not authorized";
      res.status(403).json({ reason }).end();
    }
  };
}

export function userAuthorized() {
  return function (req: Request, res: Response, next: NextFunction) {
    if (req.user) {
      next();
    } else {
      const reason = "User not authorized";
      res.status(403).json({ reason }).end();
    }
  };
}

export function adminAuthorized(adminSecret: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    const headerSecret = req.headers["x-secret-key"] as string;
    if (adminSecret === headerSecret) {
      next();
    } else {
      const reason = "Not authorized";
      res.status(403).json({ reason }).end();
    }
  };
}

// middleware that will track duration of request
export function metric(histogramMetric: Histogram<string>) {
  return function (req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime();
    res.on("finish", () => {
      const end = process.hrtime(start);
      const durationSeconds = end[0] + end[1] / 1e9;
      const statusCode = res.statusCode.toString();
      const method = req.method;
      const path = req.path;
      const client =
        typeof req.headers["x-rpch-client"] === "string"
          ? req.headers["x-rpch-client"]
          : "";

      histogramMetric
        .labels(method, path, statusCode, client)
        .observe(durationSeconds);
    });
    next();
  };
}
