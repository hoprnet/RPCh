import express from "express";
import addQuota from "./add-quota";
import fundViaHOPRd from "./fund-via-hoprd";
import registerExitNodes from "./register-exit-nodes";
import { createLogger } from "./utils";

// we do not run this build this file via turbo
/* eslint-disable turbo/no-undeclared-env-vars */
const { PORT = 3030 } = process.env;

const log = createLogger();
const app = express();

// parse JSON bodies
app.use(express.json());

// verbosly log all requests
app.use((req, _res, next) => {
  log.verbose("Request", req.method, req.originalUrl, req.query, req.body);
  next();
});

app.post("/add-quota", async (req, res) => {
  const { discoveryPlatformEndpoint, client, quota } = req.body as any;

  try {
    await addQuota(discoveryPlatformEndpoint, client, quota);
    return res.status(200);
  } catch {
    return res.status(500);
  }
});

app.post("/fund-via-hoprd", async (req, res) => {
  const { hoprdEndpoint, hoprdToken, nativeAmount, hoprAmount, recipient } =
    req.body as any;

  try {
    await fundViaHOPRd(
      hoprdEndpoint,
      hoprdToken,
      nativeAmount,
      hoprAmount,
      recipient
    );
    return res.status(200);
  } catch {
    return res.status(500);
  }
});

app.post("/register-exit-nodes", async (req, res) => {
  const {
    DISCOVERY_PLATFORM_ENDPOINT,
    HOPRD_API_ENDPOINT_1,
    HOPRD_API_TOKEN_1,
    EXIT_NODE_PUB_KEY_1,
    HOPRD_API_ENDPOINT_2,
    HOPRD_API_TOKEN_2,
    EXIT_NODE_PUB_KEY_2,
    HOPRD_API_ENDPOINT_3,
    HOPRD_API_TOKEN_3,
    EXIT_NODE_PUB_KEY_3,
    HOPRD_API_ENDPOINT_4,
    HOPRD_API_TOKEN_4,
    EXIT_NODE_PUB_KEY_4,
    HOPRD_API_ENDPOINT_5,
    HOPRD_API_TOKEN_5,
    EXIT_NODE_PUB_KEY_5,
  } = req.body as any;

  try {
    await registerExitNodes(
      DISCOVERY_PLATFORM_ENDPOINT,
      HOPRD_API_ENDPOINT_1,
      HOPRD_API_TOKEN_1,
      EXIT_NODE_PUB_KEY_1,
      HOPRD_API_ENDPOINT_2,
      HOPRD_API_TOKEN_2,
      EXIT_NODE_PUB_KEY_2,
      HOPRD_API_ENDPOINT_3,
      HOPRD_API_TOKEN_3,
      EXIT_NODE_PUB_KEY_3,
      HOPRD_API_ENDPOINT_4,
      HOPRD_API_TOKEN_4,
      EXIT_NODE_PUB_KEY_4,
      HOPRD_API_ENDPOINT_5,
      HOPRD_API_TOKEN_5,
      EXIT_NODE_PUB_KEY_5
    );
    return res.status(200);
  } catch {
    return res.status(500);
  }
});

app.listen(Number(PORT), "0.0.0.0", () => {
  log.normal(`Server is running on port=${PORT}`);
});
