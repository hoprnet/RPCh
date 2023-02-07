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
  DISCOVERY_PLATFORM_ENDPOINT: string,
  HOPRD_API_ENDPOINT_1: string,
  HOPRD_API_TOKEN_1: string,
  EXIT_NODE_PUB_KEY_1: string,
  HOPRD_API_ENDPOINT_2: string,
  HOPRD_API_TOKEN_2: string,
  EXIT_NODE_PUB_KEY_2: string,
  HOPRD_API_ENDPOINT_3: string,
  HOPRD_API_TOKEN_3: string,
  EXIT_NODE_PUB_KEY_3: string,
  HOPRD_API_ENDPOINT_4: string,
  HOPRD_API_TOKEN_4: string,
  EXIT_NODE_PUB_KEY_4: string,
  HOPRD_API_ENDPOINT_5: string,
  HOPRD_API_TOKEN_5: string,
  EXIT_NODE_PUB_KEY_5: string
): Promise<void> {
  log.normal("Registering exit nodes", {
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
  });
  const groups: {
    hoprdApiEndpoint: string;
    hoprdApiToken: string;
    exitNodePubKey: string;
  }[] = [
    {
      hoprdApiEndpoint: HOPRD_API_ENDPOINT_1,
      hoprdApiToken: HOPRD_API_TOKEN_1,
      exitNodePubKey: EXIT_NODE_PUB_KEY_1,
    },
    {
      hoprdApiEndpoint: HOPRD_API_ENDPOINT_2,
      hoprdApiToken: HOPRD_API_TOKEN_2,
      exitNodePubKey: EXIT_NODE_PUB_KEY_2,
    },
    {
      hoprdApiEndpoint: HOPRD_API_ENDPOINT_3,
      hoprdApiToken: HOPRD_API_TOKEN_3,
      exitNodePubKey: EXIT_NODE_PUB_KEY_3,
    },
    {
      hoprdApiEndpoint: HOPRD_API_ENDPOINT_4,
      hoprdApiToken: HOPRD_API_TOKEN_4,
      exitNodePubKey: EXIT_NODE_PUB_KEY_4,
    },
    {
      hoprdApiEndpoint: HOPRD_API_ENDPOINT_5,
      hoprdApiToken: HOPRD_API_TOKEN_5,
      exitNodePubKey: EXIT_NODE_PUB_KEY_5,
    },
  ];

  for (const nodes of groups) {
    const exitNodeAddress = ethersUtils.computeAddress(nodes.exitNodePubKey);
    const hoprdPeerId = await getPeerId(
      nodes.hoprdApiEndpoint,
      nodes.hoprdApiToken
    );
    await registerNode(
      DISCOVERY_PLATFORM_ENDPOINT,
      hoprdPeerId,
      nodes.hoprdApiEndpoint,
      nodes.hoprdApiToken,
      nodes.exitNodePubKey,
      exitNodeAddress
    );
  }
}
