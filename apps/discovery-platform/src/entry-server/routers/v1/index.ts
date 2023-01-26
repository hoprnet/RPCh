import express, { Request } from "express";
import { DBInstance } from "../../../db";
import { FundingServiceApi } from "../../../funding-service-api";
import { createQuota, getAllQuotasByClient, sumQuotas } from "../../../quota";
import { CreateQuota } from "../../../quota/dto";
import {
  createRegisteredNode,
  getEligibleNode,
  getRegisteredNodes,
  getRegisteredNode,
  getRewardForNode,
} from "../../../registered-node";
import { CreateRegisteredNode } from "../../../registered-node/dto";
import { createLogger } from "../../../utils";

const log = createLogger(["entry-server", "router", "v1"]);

// base amount of reward that a node will receive after completing a request
const BASE_EXTRA = 1;

export const doesClientHaveQuota = async (
  db: DBInstance,
  client: string,
  baseQuota: number
) => {
  const allQuotasFromClient = await getAllQuotasByClient(db, client);
  const sumOfClientsQuota = sumQuotas(allQuotasFromClient);
  return sumOfClientsQuota >= baseQuota;
};

export const v1Router = (ops: {
  db: DBInstance;
  baseQuota: number;
  accessToken: string;
  fundingServiceApi: FundingServiceApi;
}) => {
  const router = express.Router();

  router.use(express.json());

  router.post("/node/register", async (req, res) => {
    log.verbose("POST /node/register", req.body);
    const node: CreateRegisteredNode = req.body;
    const registered = await createRegisteredNode(ops.db, node);
    return res.json({ body: registered });
  });

  router.get(
    "/node",
    async (
      req: Request<{}, {}, {}, { excludeList?: string; hasExitNode?: string }>,
      res
    ) => {
      log.verbose("GET /node", req.query);

      const { hasExitNode, excludeList } = req.query;
      const nodes = await getRegisteredNodes(ops.db, {
        excludeList: excludeList?.split(", "),
        hasExitNode: hasExitNode === "true",
      });
      return res.json(nodes);
    }
  );

  router.get("/node/:peerId", async (req, res) => {
    const { peerId }: { peerId: string } = req.params;
    log.verbose(`GET /node/${peerId}`);
    const node = await getRegisteredNode(ops.db, peerId);
    return res.json({ node });
  });

  router.get("/funding-service/funds", async (req, res) => {
    log.verbose(`GET /funding-service/funds`);

    const funds = await ops.fundingServiceApi.getAvailableFunds();
    return res.json({ body: funds });
  });

  router.post("/client/funds", async (req, res) => {
    log.verbose(`POST /client/funds`, req.body);

    const { client, quota }: CreateQuota = req.body;
    const createdQuota = await createQuota(ops.db, {
      client,
      quota,
      actionTaker: "discovery-platform",
    });
    return res.json({ quota: createdQuota });
  });

  router.post("/request/entry-node", async (req, res) => {
    log.verbose(`POST /request/entry-node`, req.body);
    const { client, excludeList } = req.body;

    log.verbose("requesting entry node for client", client);
    if (typeof client !== "string") {
      return res
        .status(400)
        .json({ body: "Expected client to be in the body" });
    }

    // check if client has enough quota
    const doesClientHaveQuotaResponse = await doesClientHaveQuota(
      ops.db,
      client,
      ops.baseQuota
    );
    if (!doesClientHaveQuotaResponse) {
      return res.status(403).json({
        body: "Client does not have enough quota",
      });
    }
    // choose selected entry node
    const selectedNode = await getEligibleNode(ops.db, { excludeList });
    log.verbose("selected entry node", selectedNode);
    if (!selectedNode) {
      return res.status(404).json({ body: "Could not find eligible node" });
    }

    // calculate how much should be funded to entry node
    const amountToFund = getRewardForNode(
      ops.baseQuota,
      BASE_EXTRA,
      selectedNode
    );
    // fund entry node
    await ops.fundingServiceApi.requestFunds(amountToFund, selectedNode);

    // create negative quota (showing that the client has used up initial quota)
    await createQuota(ops.db, {
      client,
      quota: ops.baseQuota * -1,
      actionTaker: "discovery platform",
    });
    return res.json({ ...selectedNode, accessToken: ops.accessToken });
  });

  return router;
};
