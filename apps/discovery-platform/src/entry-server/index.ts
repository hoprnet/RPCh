import express from "express";
import { DBInstance } from "../db";
import {
  createRegisteredNode,
  getAllRegisteredNodes,
  getRegisteredNode,
} from "../registered-node";
import { CreateRegisteredNode } from "../registered-node/dto";

const app = express();
const apiRouter = express.Router();

export const entryServer = (ops: { db: DBInstance }) => {
  app.use("/api", apiRouter);
  apiRouter.use(express.json());

  apiRouter.post("/node/register", async (req, res) => {
    const node = req.body as CreateRegisteredNode;
    const registered = await createRegisteredNode(ops.db, node);
    return res.json({ body: registered });
  });

  apiRouter.get("/node", async (req, res) => {
    const { hasExitNode } = req.query;
    const nodes = await getAllRegisteredNodes(ops.db);
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

  apiRouter.get("/funding-service/funds", (req, res) => {
    // TODO
    return res.json({ body: req.route });
  });

  apiRouter.get("/request/entry-node", (req, res) => {
    // TODO
    return res.json({ body: req.route });
  });

  return app;
};
