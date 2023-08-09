import express from "express";
import * as hoprd from "./hoprd";
import addQuota from "./tasks/add-quota";
import fundHoprdNodes from "./tasks/fund-hoprd-nodes";
import fundViaHOPRd from "./tasks/fund-via-hoprd";
import fundViaWallet from "./tasks/fund-via-wallet";
import openChannels from "./tasks/open-channels";
import registerNodes from "./tasks/register-nodes";
import registerHoprdNodes from "./tasks/register-hoprd-nodes";
import { createLogger } from "./utils";
import { body, query } from "express-validator";

// we do not run this build this file via turbo
/* eslint-disable turbo/no-undeclared-env-vars */
const { PORT = 3030, DP_SECRET } = process.env;

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

app.post(
  "/add-quota",
  body("discoveryPlatformEndpoint").exists(),
  body("client").exists(),
  body("quota").exists(),
  async (req, res) => {
    try {
      const { discoveryPlatformEndpoint, client, quota } = req.body;
      if (!DP_SECRET) throw new Error("MISSING DP_SECRET ENV");

      await addQuota(discoveryPlatformEndpoint, client, quota, DP_SECRET);
      return res.sendStatus(200);
    } catch (error) {
      log.error("Could not 'add-quota'", error);
      return res.sendStatus(500);
    }
  }
);

app.post(
  "/fund-hoprd-nodes",
  body("privateKey").exists(),
  body("provider").exists(),
  body("hoprTokenAddress").exists(),
  body("nativeAmount").exists(),
  body("hoprAmount").exists(),
  body("recipients")
    .exists()
    .custom(
      (value) =>
        Array.isArray(value) && value.every((val) => typeof val === "string")
    ),
  async (req, res) => {
    try {
      const {
        privateKey,
        provider,
        hoprTokenAddress,
        nativeAmount,
        hoprAmount,
        recipients,
      } = req.body as {
        privateKey: string;
        provider: string;
        hoprTokenAddress: string;
        nativeAmount: string;
        hoprAmount: string;
        recipients: string[];
      };

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
  }
);

app.post(
  "/fund-via-hoprd",
  body("hoprdEndpoint").exists(),
  body("hoprdToken").exists(),
  body("nativeAmount").exists(),
  body("hoprAmount").exists(),
  body("recipient").exists(),
  async (req, res) => {
    try {
      const { hoprdEndpoint, hoprdToken, nativeAmount, hoprAmount, recipient } =
        req.body as {
          hoprdEndpoint: string;
          hoprdToken: string;
          nativeAmount: string;
          hoprAmount: string;
          recipient: string;
        };

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
  }
);

app.post(
  "/fund-via-wallet",
  body("privateKey").exists(),
  body("provider").exists(),
  body("hoprTokenAddress").exists(),
  body("nativeAmount").exists(),
  body("hoprAmount").exists(),
  body("recipient").exists(),
  async (req, res) => {
    try {
      const {
        privateKey,
        provider,
        hoprTokenAddress,
        nativeAmount,
        hoprAmount,
        recipient,
      } = req.body as {
        privateKey: string;
        provider: string;
        hoprTokenAddress: string;
        nativeAmount: string;
        hoprAmount: string;
        recipient: string;
      };

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
  }
);

app.get(
  "/get-hoprd-token-address",
  query("hoprdEndpoint").exists().isString(),
  query("hoprdToken").exists().isString(),
  async (req, res) => {
    try {
      const { hoprdEndpoint, hoprdToken } = req.query as {
        hoprdEndpoint: string;
        hoprdToken: string;
      };

      const tokenAddress = await hoprd
        .getInfo(hoprdEndpoint, hoprdToken)
        .then((res) => res.hoprToken);
      return res.status(200).send(tokenAddress);
    } catch (error) {
      log.error("Could not 'get-hoprd-token-address'", error);
      return res.sendStatus(500);
    }
  }
);

app.post("/get-hoprds-addresses", async (req, res) => {
  try {
    const { hoprdApiEndpoints, hoprdApiTokens } = req.body as {
      hoprdApiEndpoints: string[];
      hoprdApiTokens: string[];
    };

    if (hoprdApiEndpoints.length !== hoprdApiTokens.length) {
      throw Error(
        `Lengths of 'hoprdApiEndpoints' and 'hoprdApiTokens' do no match`
      );
    }

    const results = await Promise.all(
      hoprdApiEndpoints.map(async (endpoint, index) => {
        return await hoprd.getAddresses(endpoint, hoprdApiTokens[index]);
      })
    );

    const { hopr, native } = results.reduce<{
      hopr: string[];
      native: string[];
    }>(
      (result, addresses) => {
        result.hopr.push(addresses.hopr);
        result.native.push(addresses.native);
        return result;
      },
      {
        hopr: [],
        native: [],
      }
    );

    return res.status(200).send({ hopr, native });
  } catch (error) {
    log.error("Could not 'get-hoprd-token-address'", error);
    return res.sendStatus(500);
  }
});

app.post(
  "/open-channels",
  body("hoprAmount").exists(),
  body("hoprdApiEndpoints")
    .exists()
    .custom(
      (value) =>
        Array.isArray(value) && value.every((val) => typeof val === "string")
    ),
  body("hoprdTokens")
    .exists()
    .custom(
      (value) =>
        Array.isArray(value) && value.every((val) => typeof val === "string")
    ),
  async (req, res) => {
    try {
      const { hoprAmount, hoprdApiEndpoints, hoprdTokens } = req.body as {
        hoprAmount: string;
        hoprdApiEndpoints: string[];
        hoprdTokens: string[];
      };

      await openChannels(hoprAmount, hoprdApiEndpoints, hoprdTokens);
      return res.sendStatus(200);
    } catch (error) {
      log.error("Could not 'open-channels'", error);
      return res.sendStatus(500);
    }
  }
);

app.post(
  "/register-nodes",
  body("discoveryPlatformEndpoint").exists(),
  body("client").exists(),
  body("chainId").exists(),
  body("hoprdApiEndpoints")
    .exists()
    .custom(
      (value) =>
        Array.isArray(value) && value.every((val) => typeof val === "string")
    ),
  body("hoprdApiEndpointsExt")
    .exists()
    .custom(
      (value) =>
        Array.isArray(value) && value.every((val) => typeof val === "string")
    ),
  body("hoprdApiTokens")
    .exists()
    .custom(
      (value) =>
        Array.isArray(value) && value.every((val) => typeof val === "string")
    ),
  body("exitNodePubKeys")
    .exists()
    .custom(
      (value) =>
        Array.isArray(value) && value.every((val) => typeof val === "string")
    ),
  body("hasExitNodes")
    .exists()
    .custom(
      (value) =>
        Array.isArray(value) && value.every((val) => typeof val === "boolean")
    ),
  async (req, res) => {
    try {
      const {
        discoveryPlatformEndpoint,
        chainId,
        hoprdApiEndpoints,
        hoprdApiEndpointsExt,
        hoprdApiTokens,
        exitNodePubKeys,
        client,
        hasExitNodes,
      } = req.body as {
        discoveryPlatformEndpoint: string;
        client: string;
        chainId: string;
        hoprdApiEndpoints: string[];
        hoprdApiEndpointsExt: string[];
        hoprdApiTokens: string[];
        exitNodePubKeys: string[];
        hasExitNodes: boolean[];
      };

      await registerNodes(
        discoveryPlatformEndpoint,
        client,
        chainId,
        hoprdApiEndpoints,
        hoprdApiEndpointsExt,
        hoprdApiTokens,
        exitNodePubKeys,
        hasExitNodes
      );
      return res.sendStatus(200);
    } catch (error) {
      log.error("Could not 'register-nodes'", error);
      return res.sendStatus(500);
    }
  }
);

app.post(
  "/register-hoprd-nodes",
  body("privateKey").exists(),
  body("provider").exists(),
  body("nftAddress").exists(),
  body("nftId").exists(),
  body("stakeAddress").exists(),
  body("registryAddress").exists(),
  body("peerIds")
    .exists()
    .custom(
      (value) =>
        Array.isArray(value) && value.every((val) => typeof val === "string")
    ),
  async (req, res) => {
    try {
      const {
        privateKey,
        provider,
        nftAddress,
        nftId,
        stakeAddress,
        registryAddress,
        peerIds,
      } = req.body as {
        privateKey: string;
        provider: string;
        nftAddress: string;
        nftId: string;
        stakeAddress: string;
        registryAddress: string;
        peerIds: string[];
      };

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
  }
);

app.listen(Number(PORT), "0.0.0.0", () => {
  log.normal(`Server is running on port=${PORT}`);
});
