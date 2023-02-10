import express from "express";
import * as hoprd from "./hoprd";
import addQuota from "./tasks/add-quota";
import fundHoprdNodes from "./tasks/fund-hoprd-nodes";
import fundViaHOPRd from "./tasks/fund-via-hoprd";
import fundViaWallet from "./tasks/fund-via-wallet";
import openChannels from "./tasks/open-channels";
import registerExitNodes from "./tasks/register-exit-nodes";
import registerHoprdNodes from "./tasks/register-hoprd-nodes";
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

app.post("/fund-hoprd-nodes", async (req, res) => {
  const {
    privateKey,
    provider,
    hoprTokenAddress,
    nativeAmount,
    hoprAmount,
    recipients,
  } = req.body as any;

  try {
    await fundHoprdNodes(
      privateKey,
      provider,
      hoprTokenAddress,
      nativeAmount,
      hoprAmount,
      recipients
    );
    return res.sendStatus(200);
  } catch (error) {
    log.error("Could not 'fund-hoprd-nodes'", error);
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

app.post("/fund-via-wallet", async (req, res) => {
  const {
    privateKey,
    provider,
    hoprTokenAddress,
    nativeAmount,
    hoprAmount,
    recipient,
  } = req.body as any;

  try {
    await fundViaWallet(
      privateKey,
      provider,
      hoprTokenAddress,
      nativeAmount,
      hoprAmount,
      recipient
    );
    return res.sendStatus(200);
  } catch (error) {
    log.error("Could not 'fund-via-wallet'", error);
    return res.sendStatus(500);
  }
});

app.get("/get-hoprd-token-address", async (req, res) => {
  const { hoprdEndpoint, hoprdToken } = req.query as any;

  try {
    const tokenAddress = await hoprd
      .getInfo(hoprdEndpoint, hoprdToken)
      .then((res) => res.hoprToken);
    return res.status(200).send(tokenAddress);
  } catch (error) {
    log.error("Could not 'get-hoprd-token-address'", error);
    return res.sendStatus(500);
  }
});

app.post("/open-channels", async (req, res) => {
  const { hoprAmount, hoprdApiEndpoints, hoprdTokens } = req.body as any;

  try {
    await openChannels(hoprAmount, hoprdApiEndpoints, hoprdTokens);
    return res.sendStatus(200);
  } catch (error) {
    log.error("Could not 'open-channels'", error);
    return res.sendStatus(500);
  }
});

app.post("/register-exit-nodes", async (req, res) => {
  const {
    discoveryPlatformEndpoint,
    hoprdApiEndpoints,
    hoprdApiEndpointsExt,
    hoprdApiTokens,
    exitNodePubKeys,
  } = req.body as any;

  try {
    await registerExitNodes(
      discoveryPlatformEndpoint,
      hoprdApiEndpoints,
      hoprdApiEndpointsExt,
      hoprdApiTokens,
      exitNodePubKeys
    );
    return res.sendStatus(200);
  } catch (error) {
    log.error("Could not 'register-exit-nodes'", error);
    return res.sendStatus(500);
  }
});

app.post("/register-hoprd-nodes", async (req, res) => {
  const {
    privateKey,
    provider,
    nftAddress,
    nftId,
    stakeAddress,
    registryAddress,
    peerIds,
  } = req.body as any;

  try {
    await registerHoprdNodes(
      privateKey,
      provider,
      nftAddress,
      nftId,
      stakeAddress,
      registryAddress,
      peerIds
    );
    return res.sendStatus(200);
  } catch (error) {
    log.error("Could not 'register-hoprd-nodes'", error);
    return res.sendStatus(500);
  }
});

app.listen(Number(PORT), "0.0.0.0", () => {
  log.normal(`Server is running on port=${PORT}`);
});
