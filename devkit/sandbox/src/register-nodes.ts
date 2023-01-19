/**
 * FOR DEVELOPMENT ONLY
 * Creates a random wallet and funds it with NATIVE and HOPR tokens
 * using one of our HOPRd nodes.
 * Prints our the private key of the wallet generated.
 */
import fetch from "node-fetch";
import { keccak256 } from "js-sha3";

// we do not run this build this file via turbo
/* eslint-disable turbo/no-undeclared-env-vars */
const {
  HOPRD_API_TOKEN,
  EXIT_NODE_PUB_KEY_1,
  EXIT_NODE_PUB_KEY_2,
  EXIT_NODE_PUB_KEY_3,
  EXIT_NODE_PUB_KEY_4,
  EXIT_NODE_PUB_KEY_5,
  NODE_ENV = "development",
} = process.env;

const DP_API_ENDPOINT = "http://localhost:3020";

const debug = NODE_ENV === "production" ? () => {} : console.log;

if (!HOPRD_API_TOKEN)
  throw Error("Missing env variable 'FUNDING_HOPRD_API_TOKEN'");
if (
  [
    EXIT_NODE_PUB_KEY_1,
    EXIT_NODE_PUB_KEY_2,
    EXIT_NODE_PUB_KEY_3,
    EXIT_NODE_PUB_KEY_4,
    EXIT_NODE_PUB_KEY_5,
  ].includes(undefined)
) {
  throw Error("Missing exit node public key ENV variable");
}

const publicKeys = [
  EXIT_NODE_PUB_KEY_1,
  EXIT_NODE_PUB_KEY_2,
  EXIT_NODE_PUB_KEY_3,
  EXIT_NODE_PUB_KEY_4,
  EXIT_NODE_PUB_KEY_5,
] as string[];

const headers = {
  "Content-Type": "application/json",
  "Accept-Content": "application/json",
  Authorization: "Basic " + btoa(HOPRD_API_TOKEN),
};

const getPeerId = async (apiEndpoint: string): Promise<string> => {
  const url = new URL("/api/v2/account/addresses", apiEndpoint);

  return fetch(url.toString(), {
    method: "GET",
    headers,
  })
    .then((res) => res.json() as Promise<{ hopr: string; native: string }>)
    .then((res) => res.hopr);
};

const getAddressFromPublicKey = (publicKey: string): string => {
  const publicKeyHash = keccak256(Buffer.from(publicKey.slice(2), "hex"));
  const address = "0x" + publicKeyHash.slice(-40);
  return address;
};

const registerNode = async (
  peerId: string,
  hoprdApiEndpoint: string,
  hoprdApiPort: number,
  exitNodePubKey: string,
  nativeAddress: string
): Promise<string> => {
  const url = new URL("/api/v1/node/register", DP_API_ENDPOINT);
  const body = {
    hasExitNode: true,
    peerId,
    chainId: 1,
    hoprdApiEndpoint,
    hoprdApiPort,
    exitNodePubKey,
    nativeAddress,
  };
  debug("Registering node", body);

  return fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).then((res) => res.json());
};

const main = async () => {
  debug("Pre-start", {
    HOPRD_API_TOKEN,
    EXIT_NODE_PUB_KEY_1,
    EXIT_NODE_PUB_KEY_2,
    EXIT_NODE_PUB_KEY_3,
    EXIT_NODE_PUB_KEY_4,
    EXIT_NODE_PUB_KEY_5,
  });

  let port = 13300;

  for (const publicKey of publicKeys) {
    const nativeAddress = getAddressFromPublicKey(publicKey);
    const hoprdApiEndpoint = "http://localhost";
    const hoprdApiPort = ++port;
    const peerId = await getPeerId(hoprdApiEndpoint + ":" + hoprdApiPort);
    await registerNode(
      peerId,
      hoprdApiEndpoint,
      hoprdApiPort,
      publicKey,
      nativeAddress
    );
  }
};

main().then(console.log).catch(console.error);
