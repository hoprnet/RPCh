import express from "express";
import { DBInstance } from "../db";
import { FundingServiceApi } from "../funding-service-api";
import { v1Router } from "./routers/v1";
import compression from "compression";
const app = express();

export const entryServer = (ops: {
  db: DBInstance;
  baseQuota: bigint;
  fundingServiceApi: FundingServiceApi;
}) => {
  app.use(compression());

  app.use(
    "/api/v1",
    v1Router({
      baseQuota: ops.baseQuota,
      db: ops.db,
      fundingServiceApi: ops.fundingServiceApi,
    })
  );

  return app;
};
