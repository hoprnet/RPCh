import express from "express";
import addQuota from "./add-quota";
import fundViaHOPRd from "./fund-via-hoprd";
import getHOPRdTokenAddress from "./get-hoprd-token-address";
import registerExitNodes from "./register-exit-nodes";
import { createLogger } from "./utils";

// we do not run this build this file via turbo
/* eslint-disable turbo/no-undeclared-env-vars */
const { PORT = 3030 } = process.env;

const log = createLogger();
const app = express();

log.verbose("Running 'manager' with ENV", { PORT });

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
    return res.sendStatus(200);
  } catch (error) {
    log.error("Could not 'add-quota'", error);
    return res.sendStatus(500);
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
    return res.sendStatus(200);
  } catch (error) {
    log.error("Could not 'fund-via-hoprd'", error);
    return res.sendStatus(500);
  }
});

app.get("/get-hoprd-token-address", async (req, res) => {
  const { hoprdEndpoint, hoprdToken } = req.query as any;

  try {
    const tokenAddress = await getHOPRdTokenAddress(hoprdEndpoint, hoprdToken);
    return res.status(200).send(tokenAddress);
  } catch (error) {
    log.error("Could not 'get-hoprd-token-address'", error);
    return res.sendStatus(500);
  }
});

app.post("/register-exit-nodes", async (req, res) => {
  const {
    discoveryPlatformEndpoint,
    hoprdApiEndpoint1,
    hoprdApiEndpoint1Ext,
    hoprdApiToken1,
    exitNodePubKey1,
    hoprdApiEndpoint2,
    hoprdApiEndpoint2Ext,
    hoprdApiToken2,
    exitNodePubKey2,
    hoprdApiEndpoint3,
    hoprdApiEndpoint3Ext,
    hoprdApiToken3,
    exitNodePubKey3,
    hoprdApiEndpoint4,
    hoprdApiEndpoint4Ext,
    hoprdApiToken4,
    exitNodePubKey4,
    hoprdApiEndpoint5,
    hoprdApiEndpoint5Ext,
    hoprdApiToken5,
    exitNodePubKey5,
  } = req.body as any;

  try {
    await registerExitNodes(
      discoveryPlatformEndpoint,
      hoprdApiEndpoint1,
      hoprdApiEndpoint1Ext,
      hoprdApiToken1,
      exitNodePubKey1,
      hoprdApiEndpoint2,
      hoprdApiEndpoint2Ext,
      hoprdApiToken2,
      exitNodePubKey2,
      hoprdApiEndpoint3,
      hoprdApiEndpoint3Ext,
      hoprdApiToken3,
      exitNodePubKey3,
      hoprdApiEndpoint4,
      hoprdApiEndpoint4Ext,
      hoprdApiToken4,
      exitNodePubKey4,
      hoprdApiEndpoint5,
      hoprdApiEndpoint5Ext,
      hoprdApiToken5,
      exitNodePubKey5
    );
    return res.sendStatus(200);
  } catch (error) {
    log.error("Could not 'register-exit-nodes'", error);
    return res.sendStatus(500);
  }
});

app.listen(Number(PORT), "0.0.0.0", () => {
  log.normal(`Server is running on port=${PORT}`);
});
