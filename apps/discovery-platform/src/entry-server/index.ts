import express from "express";
import { DBInstance } from "../db";
import { FundingPlatformApi } from "../funding-platform-api";
import { createQuota, getAllQuotasByClient, sumQuotas } from "../quota";
import { CreateQuota } from "../quota/dto";
import {
  createRegisteredNode,
  getExitNodes,
  getNonExitNodes,
  getRegisteredNode,
  getEligibleNode,
  getRewardForNode,
} from "../registered-node";
import { CreateRegisteredNode } from "../registered-node/dto";

const app = express();
const apiRouter = express.Router();

export const doesClientHaveQuota = async (
  db: DBInstance,
  client: string,
  baseQuota: number
) => {
  const allQuotasFromClient = await getAllQuotasByClient(db, client);
  const sumOfClientsQuota = sumQuotas(allQuotasFromClient);
  console.log(allQuotasFromClient, sumOfClientsQuota);
  return sumOfClientsQuota >= baseQuota;
};

export const entryServer = (ops: {
  db: DBInstance;
  baseQuota: number;
  accessToken: string;
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
    if (hasExitNode === "true") {
      const nodes = await getExitNodes(ops.db);
      return res.json(nodes);
    } else {
      const nodes = await getNonExitNodes(ops.db);
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
    const selectedNode = await getEligibleNode(ops.db);
    if (!selectedNode) {
      return res.json({ body: "Could not find eligible node" });
    }

    // calculate how much should be funded to entry node
    const amountToFund = getRewardForNode(ops.baseQuota, selectedNode);
    // fund entry node
    await ops.fundingPlatformApi.requestFunds(amountToFund, selectedNode);

    // create negative quota (showing that the client has used up initial quota)
    await createQuota(ops.db, {
      client,
      quota: ops.baseQuota * -1,
      actionTaker: "discovery platform",
      createdAt: new Date().toISOString(),
    });
    return res.json({ ...selectedNode, accessToken: ops.accessToken });
  });

  return app;
};
