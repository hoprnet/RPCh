import express from "express";
import { DBInstance } from "../db";
import {
  createRegisteredNode,
  getRegisteredNodes,
  getRegisteredNode,
  getNodeAccessToken,
} from "../registered-node";
import { CreateRegisteredNode } from "../registered-node/dto";
import { CreateQuota } from "../quota/dto";
import { createQuota, getAllQuotasByClient, sumQuotas } from "../quota";
import { FundingPlatformApi } from "../funding-platform-api";

const app = express();
const apiRouter = express.Router();

export const doesClientHaveQuota = async (
  db: DBInstance,
  client: string,
  baseQuota: number
) => {
  const allQuotasFromClient = await getAllQuotasByClient(db, client);
  const sumOfClientsQuota = sumQuotas(allQuotasFromClient);
  return sumOfClientsQuota >= baseQuota;
};

export const entryServer = (ops: {
  db: DBInstance;
  baseQuota: number;
  fundingPlatformApi: FundingPlatformApi;
}) => {
  app.use("/api", apiRouter);
  apiRouter.use(express.json());

  apiRouter.post("/node/register", async (req, res) => {
    const node = req.body as CreateRegisteredNode;
    const registered = await createRegisteredNode(ops.db, node);
    return res.json({ body: registered });
  });

  apiRouter.get("/node", async (req, res) => {
    const { hasExitNode } = req.query;
    const nodes = await getRegisteredNodes(ops.db);
    if (hasExitNode === "true") {
      return res.json(nodes.filter((node) => node.hasExitNode));
    } else {
      return res.json(nodes.filter((node) => !node.hasExitNode));
    }
  });

  apiRouter.get("/node/:peerId", async (req, res) => {
    const { peerId } = req.params;
    const node = await getRegisteredNode(ops.db, peerId as string);
    return res.json({ node });
  });

  apiRouter.get("/funding-service/funds", async (req, res) => {
    const funds = await ops.fundingPlatformApi.getAvailableFunds();
    return res.json({ body: funds });
  });

  apiRouter.post("/client/funds", async (req, res) => {
    const { client, quota } = req.body as CreateQuota;
    const createdQuota = await createQuota(ops.db, {
      client,
      quota,
      actionTaker: "discovery platform",
      createdAt: new Date().toISOString(),
    });
    return res.json({ quota: createdQuota });
  });

  apiRouter.get("/request/entry-node", async (req, res) => {
    // TODO: add funding to selected node
    const { client } = req.body;
    // check if client has enough quota
    const doesClientHaveQuotaResponse = await doesClientHaveQuota(
      ops.db,
      client,
      ops.baseQuota
    );
    if (!doesClientHaveQuotaResponse) {
      return res.status(400).json({
        body: "Client does not have enough quota",
      });
    }
    // choose selected entry node
    const selectedNodeAccessToken = await getNodeAccessToken(ops.db);
    // create negative quota (showing that the client has used up initial quota)
    await createQuota(ops.db, {
      client,
      quota: ops.baseQuota * -1,
      actionTaker: "discovery platform",
      createdAt: new Date().toISOString(),
    });
    return res.json({ body: selectedNodeAccessToken });
  });

  return app;
};
