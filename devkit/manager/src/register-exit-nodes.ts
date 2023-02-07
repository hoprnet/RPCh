import fetch from "node-fetch";
import { utils as ethersUtils } from "ethers";
import { utils } from "@rpch/common";
import { createLogger, getPeerId } from "./utils";

const log = createLogger(["register-exit-nodes"]);

async function registerNode(
  discoveryPlatformEndpoint: string,
  hoprdPeerId: string,
  hoprdApiEndpoint: string,
  hoprdApiToken: string,
  exitNodePubKey: string,
  nativeAddress: string
): Promise<void> {
  log.verbose("Registering node", {
    discoveryPlatformEndpoint,
    hoprdPeerId,
    hoprdApiEndpoint,
    hoprdApiToken,
    exitNodePubKey,
    nativeAddress,
  });

  const [url, headers] = utils.createApiUrl(
    "http",
    discoveryPlatformEndpoint,
    "/api/v1/node/register"
  );
  return fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      hasExitNode: true,
      peerId: hoprdPeerId,
      chainId: 1,
      hoprdApiEndpoint,
      hoprdApiToken,
      exitNodePubKey,
      nativeAddress,
    }),
  }).then((res) => res.json());
}

export default async function main(
  discoveryPlatformEndpoint: string,
  hoprdApiEndpoint1: string,
  hoprdApiToken1: string,
  exitNodePubKey1: string,
  hoprdApiEndpoint2: string,
  hoprdApiToken2: string,
  exitNodePubKey2: string,
  hoprdApiEndpoint3: string,
  hoprdApiToken3: string,
  exitNodePubKey3: string,
  hoprdApiEndpoint4: string,
  hoprdApiToken4: string,
  exitNodePubKey4: string,
  hoprdApiEndpoint5: string,
  hoprdApiToken5: string,
  exitNodePubKey5: string
): Promise<void> {
  log.normal("Registering exit nodes", {
    discoveryPlatformEndpoint,
    hoprdApiEndpoint1,
    hoprdApiToken1,
    exitNodePubKey1,
    hoprdApiEndpoint2,
    hoprdApiToken2,
    exitNodePubKey2,
    hoprdApiEndpoint3,
    hoprdApiToken3,
    exitNodePubKey3,
    hoprdApiEndpoint4,
    hoprdApiToken4,
    exitNodePubKey4,
    hoprdApiEndpoint5,
    hoprdApiToken5,
    exitNodePubKey5,
  });
  const groups: {
    hoprdApiEndpoint: string;
    hoprdApiToken: string;
    exitNodePubKey: string;
  }[] = [
    {
      hoprdApiEndpoint: hoprdApiEndpoint1,
      hoprdApiToken: hoprdApiToken1,
      exitNodePubKey: exitNodePubKey1,
    },
    {
      hoprdApiEndpoint: hoprdApiEndpoint2,
      hoprdApiToken: hoprdApiToken2,
      exitNodePubKey: exitNodePubKey2,
    },
    {
      hoprdApiEndpoint: hoprdApiEndpoint3,
      hoprdApiToken: hoprdApiToken3,
      exitNodePubKey: exitNodePubKey3,
    },
    {
      hoprdApiEndpoint: hoprdApiEndpoint4,
      hoprdApiToken: hoprdApiToken4,
      exitNodePubKey: exitNodePubKey4,
    },
    {
      hoprdApiEndpoint: hoprdApiEndpoint5,
      hoprdApiToken: hoprdApiToken5,
      exitNodePubKey: exitNodePubKey5,
    },
  ];

  for (const nodes of groups) {
    const exitNodeAddress = ethersUtils.computeAddress(nodes.exitNodePubKey);
    const hoprdPeerId = await getPeerId(
      nodes.hoprdApiEndpoint,
      nodes.hoprdApiToken
    );
    await registerNode(
      discoveryPlatformEndpoint,
      hoprdPeerId,
      nodes.hoprdApiEndpoint,
      nodes.hoprdApiToken,
      nodes.exitNodePubKey,
      exitNodeAddress
    );
  }
}
