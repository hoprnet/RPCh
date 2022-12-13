import express from "express";

const app = express();
const apiRouter = express.Router();

export const entryServer = () => {
  app.use("/api", apiRouter);
  apiRouter.use(express.json());

  apiRouter.post("/node/register", (req, res) => {
    return res.json({ body: req.route });
  });
  apiRouter.get("/node", (req, res) => {
    return res.json({ body: req.route });
  });
  apiRouter.get("/node/:peerId", (req, res) => {
    return res.json({ body: req.route });
  });
  apiRouter.get("/funding-service/funds", (req, res) => {
    return res.json({ body: req.route });
  });
  apiRouter.get("/request/entry-node", (req, res) => {
    return res.json({ body: req.route });
  });
  apiRouter.post("/client/funds", (req, res) => {
    return res.json({ body: req.route });
  });

  return app;
};
