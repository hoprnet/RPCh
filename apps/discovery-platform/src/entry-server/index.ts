import express, { Request } from "express";
import { DBInstance } from "../db";
import { FundingServiceApi } from "../funding-service-api";
import { v1Router } from "./routers/v1";

const app = express();

export const entryServer = (ops: {
  db: DBInstance;
  baseQuota: bigint;
  accessToken: string;
  fundingServiceApi: FundingServiceApi;
}) => {
  app.use(
    "/api/v1",
    v1Router({
      accessToken: ops.accessToken,
      baseQuota: ops.baseQuota,
      db: ops.db,
      fundingServiceApi: ops.fundingServiceApi,
    })
  );

  return app;
};
