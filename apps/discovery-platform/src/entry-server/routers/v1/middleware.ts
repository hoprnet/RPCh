import type { NextFunction, Request, Response } from "express";
import type { Histogram } from "prom-client";
import { getSumOfQuotasPaidByClient, type DBInstance } from "../../../db";
import memoryCache from "memory-cache";
import { createLogger } from "../../../utils";
import { getClient } from "../../../client";

const log = createLogger(["entry-server", "router", "v1", "middleware"]);

export const getCache = () => {
  return (req: Request, res: Response<any, any>, next: NextFunction) => {
    let key = req.originalUrl || req.url;
    let cachedBody = memoryCache.get(key);
    if (cachedBody) {
      log.verbose("Returning cached value for endpoint: ", key);
      return res.json(cachedBody);
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
  const sumOfClientsQuota = await getSumOfQuotasPaidByClient(db, client);
  return sumOfClientsQuota >= baseQuota;
};

export const clientExists =
  (db: DBInstance) =>
  async (req: Request, res: Response<any, any>, next: NextFunction) => {
    const clientId = req.headers["x-rpch-client"] as string;
    const client = await getClient(db, clientId);
    if (!client) {
      res.status(404).json("Client does not exist");
    }
    next();
  };

// middleware that will track duration of request
export const metricMiddleware =
  (histogramMetric: Histogram<string>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();
    res.on("finish", () => {
      const end = process.hrtime(start);
      const durationSeconds = end[0] + end[1] / 1e9;
      const statusCode = res.statusCode.toString();
      const method = req.method;
      const path = req.path;
      histogramMetric.labels(method, path, statusCode).observe(durationSeconds);
    });
    next();
  };
