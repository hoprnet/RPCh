import express, { Request, Response } from "express";
import {
  ParamSchema,
  Schema,
  body,
  checkSchema,
  param,
  validationResult,
} from "express-validator";
import { DBInstance } from "../../../db";
import { FundingServiceApi } from "../../../funding-service-api";
import { createQuota, getAllQuotasByClient, sumQuotas } from "../../../quota";
import { CreateQuota } from "../../../quota/dto";
import {
  createRegisteredNode,
  getEligibleNode,
  getRegisteredNode,
  getRegisteredNodes,
  getRewardForNode,
} from "../../../registered-node";
import { CreateRegisteredNode } from "../../../registered-node/dto";
import { createLogger } from "../../../utils";

const log = createLogger(["entry-server", "router", "v1"]);

// base amount of reward that a node will receive after completing a request
const BASE_EXTRA = 1;

// Sanitization and Validation
const registerNodeSchema: Record<keyof CreateRegisteredNode, ParamSchema> = {
  peerId: {
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
  exitNodePubKey: {
    in: "body",
    exists: {
      errorMessage: "Expected exitNodePubKey to be in the body",
      bail: true,
    },
    isString: true,
  },
  hasExitNode: {
    in: "body",
    exists: {
      errorMessage: "Expected hasExitNode to be in the body",
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
  hoprdApiPort: {
    in: "body",
    exists: {
      errorMessage: "Expected hoprdApiPort to be in the body",
      bail: true,
    },
    isNumeric: true,
    toInt: true,
  },
  nativeAddress: {
    in: "body",
    exists: {
      errorMessage: "Expected nativeAddress to be in the body",
      bail: true,
    },
    isString: true,
  },
};

const getNodeSchema: Record<
  keyof { excludeList?: string; hasExitNode?: string },
  ParamSchema
> = {
  excludeList: {
    optional: true,
    in: "query",
    custom: {
      options: (value) => {
        return isExcludeListSafe(value);
      },
    },
  },
  hasExitNode: {
    optional: true,
    in: "query",
    isBoolean: true,
  },
};

const isExcludeListSafe = (value: string) => {
  // check that the exclude list only has ids and commas
  const noSpecialCharsRegex = /^[a-zA-Z0-9]+$/;
  if (noSpecialCharsRegex.test(value)) return true;

  const alphanumericCommaRegex = /^[a-zA-Z0-9,]+$/;
  return alphanumericCommaRegex.test(value);
};

// Express Router
export const v1Router = (ops: {
  db: DBInstance;
  baseQuota: bigint;
  accessToken: string;
  fundingServiceApi: FundingServiceApi;
}) => {
  const router = express.Router();

  router.use(express.json());

  router.post(
    "/node/register",
    checkSchema(registerNodeSchema),
    async (req: Request, res: Response) => {
      try {
        log.verbose("POST /node/register", req.body);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const node: CreateRegisteredNode = req.body;
        const registered = await createRegisteredNode(ops.db, node);
        return res.json({ body: registered });
      } catch (e) {
        log.error("Can not register node", e);
        return res.status(500).json({ body: "Unexpected error" });
      }
    }
  );

  router.get(
    "/node",
    checkSchema(getNodeSchema),
    async (
      req: Request<{}, {}, {}, { excludeList?: string; hasExitNode?: string }>,
      res: Response
    ) => {
      try {
        log.verbose("GET /node", req.query);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const { hasExitNode, excludeList } = req.query;
        const nodes = await getRegisteredNodes(ops.db, {
          excludeList: excludeList?.split(", "),
          hasExitNode: hasExitNode ? hasExitNode === "true" : undefined,
        });
        return res.json(nodes);
      } catch (e) {
        log.error("Can not get nodes", e);
        return res.status(500).json({ body: "Unexpected error" });
      }
    }
  );

  router.get(
    "/node/:peerId",
    param("peerId").isAlphanumeric(),
    async (req: Request<{ peerId: string }>, res: Response) => {
      try {
        log.verbose(`GET /node/:peerId`, req.params);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const { peerId }: { peerId: string } = req.params;
        const node = await getRegisteredNode(ops.db, peerId);
        return res.json({ node });
      } catch (e) {
        log.error("Can not get node with id", e);
        return res.status(500).json({ body: "Unexpected error" });
      }
    }
  );

  router.get("/funding-service/funds", async (req, res) => {
    log.verbose(`GET /funding-service/funds`);
    try {
      const funds = await ops.fundingServiceApi.getAvailableFunds();
      return res.json({ body: funds });
    } catch (e) {
      log.error("Can not retrieve funds from funding service", e);
      return res.status(500).json({ body: "Unexpected error" });
    }
  });

  router.post(
    "/client/funds",
    body("client").exists().bail().isAlphanumeric(),
    body("quota").exists().bail().isNumeric(),
    async (req, res) => {
      try {
        log.verbose(`POST /client/funds`, req.body);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const { client, quota }: CreateQuota = req.body;
        const createdQuota = await createQuota(ops.db, {
          client,
          quota,
          actionTaker: "discovery-platform",
        });
        return res.json({ quota: createdQuota });
      } catch (e) {
        log.error("Can not create funds", e);
        return res.status(500).json({ body: "Unexpected error" });
      }
    }
  );

  router.post(
    "/request/entry-node",
    body("client").exists().bail().isAlphanumeric(),
    body("excludeList")
      .optional()
      .custom((value) => isExcludeListSafe(value)),
    async (req, res) => {
      try {
        log.verbose(`POST /request/entry-node`, req.body);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        const { client, excludeList } = req.body;

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
          quota: ops.baseQuota * BigInt(-1),
          actionTaker: "discovery platform",
        });
        return res.json({ ...selectedNode, accessToken: ops.accessToken });
      } catch (e) {
        log.error("Can not retrieve entry node", e);
        return res.status(500).json({ body: "Unexpected error" });
      }
    }
  );

  return router;
};

export const doesClientHaveQuota = async (
  db: DBInstance,
  client: string,
  baseQuota: bigint
) => {
  const allQuotasFromClient = await getAllQuotasByClient(db, client);
  const sumOfClientsQuota = sumQuotas(allQuotasFromClient);
  return sumOfClientsQuota >= baseQuota;
};
