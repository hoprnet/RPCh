import type Nock from "nock";
import Request from "./request";
import Response from "./response";
import { Identity } from "./utils";

// example of a working provider
export const PROVIDER = "https://primary.gnosis-chain.rpc.hoprtech.net";

// reusable identity fixtures
export const PEER_ID_A =
  "16Uiu2HAmA5h2q7G2RrZMA4znAH4p8KBcuJWUmjjVfpW5DXePQ2He";
export const PEER_ID_B =
  "16Uiu2HAkwJdCap1ErGKjtLeHjfnN53TD8kryG48NYVPWx4HhRfKW";
export const PUB_KEY_A =
  "0x02d9c0e0ab99d251a8fd2cd48df6554dfd5112afe589a3dcab75928aea34f98581";
export const PUB_KEY_B =
  "0x021be92a59234dbef617f5eb0d5426758a6cad16f951458a3d753aa22c09e75509";
export const PRIV_KEY_A =
  "0xd12c951563ee7e322562b7ce7a31c37cc6c10d9b86f834ed30f7c4ab42ae8de0";
export const PRIV_KEY_B =
  "0x1a7a8c37e30c97ebf532042bdc37fe724a3950b0cd7ea5a57c9f3e30c53c44a3";

export const IDENTITY_A = new Identity(PEER_ID_A, PRIV_KEY_A);
export const IDENTITY_A_NO_PRIV = new Identity(PEER_ID_A);
export const IDENTITY_B = new Identity(PEER_ID_B, PRIV_KEY_B);
export const IDENTITY_B_NO_PRIV = new Identity(PEER_ID_B);

/**
 * A small RPC request
 */
export const RPC_REQ_SMALL = `{"id":"1663836360444","jsonrpc":"2.0","method":"eth_chainId","params":[]}`;
/**
 * A large RPC request that needs to be split into many segments
 */
export const RPC_REQ_LARGE = `{"id":"1663836360445","jsonrpc":"2.0","method":"eth_chainId","params":["sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample"]}`;

/**
 * A small RPC response
 */
export const RPC_RES_SMALL = `{"id":1663836360444,"jsonrpc": "2.0","result": "0x0234c8a3397aab58"}`;
/**
 * A large RPC response that needs to be split into many segments
 */
export const RPC_RES_LARGE = `{"id":1663836360444,"jsonrpc": "2.0","result": "0x0234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab580234c8a3397aab58"}`;

/**
 * Create a new client request
 * with a fresh crypto session
 * @param size
 * @returns Request
 */
export const createMockedClientRequest = (
  size: "small" | "large" = "small"
): Request => {
  return Request.createRequest(
    PROVIDER,
    size === "small" ? RPC_REQ_SMALL : RPC_REQ_LARGE,
    IDENTITY_A_NO_PRIV,
    IDENTITY_B_NO_PRIV
  );
};

export function createMockedRequestFlow(
  steps: 2,
  size?: "small" | "large"
): [clientRequest: Request, exitNodeRequest: Request];
export function createMockedRequestFlow(
  steps: 3,
  size?: "small" | "large"
): [
  clientRequest: Request,
  exitNodeRequest: Request,
  exitNodeResponse: Response
];
export function createMockedRequestFlow(
  steps: 4,
  size?: "small" | "large"
): [
  clientRequest: Request,
  exitNodeRequest: Request,
  exitNodeResponse: Response,
  clientResponse: Response
];
/**
 * Recreate a whole flow of request and responses.
 * With steps you can indicate how much you want
 * to generate.
 * @param steps
 * @param size
 */
export function createMockedRequestFlow(
  steps: 2 | 3 | 4 = 4,
  size: "small" | "large" = "small"
): [
  clientRequest: Request,
  exitNodeRequest: Request,
  exitNodeResponse?: Response,
  clientResponse?: Response
] {
  const ENTRY_NODE = IDENTITY_A_NO_PRIV;
  const EXIT_NODE = IDENTITY_B;
  const EXIT_NODE_NO_PRIV = IDENTITY_B_NO_PRIV;

  // client
  const clientRequest = Request.createRequest(
    PROVIDER,
    size === "small" ? RPC_REQ_SMALL : RPC_REQ_LARGE,
    ENTRY_NODE,
    EXIT_NODE_NO_PRIV
  );

  // exit node
  const exitNodeRequest = Request.fromMessage(
    clientRequest.toMessage(),
    EXIT_NODE,
    BigInt(0),
    () => {}
  );
  if (steps === 2) return [clientRequest, exitNodeRequest];

  const exitNodeResponse = Response.createResponse(
    exitNodeRequest,
    size === "small" ? RPC_RES_SMALL : RPC_RES_LARGE
  );
  if (steps === 3) return [clientRequest, exitNodeRequest, exitNodeResponse];

  // client
  const clientResponse = Response.fromMessage(
    clientRequest,
    exitNodeResponse.toMessage(),
    BigInt(0),
    () => {}
  );

  return [clientRequest, exitNodeRequest, exitNodeResponse, clientResponse];
}

/**
 * An RPC response which is an error
 */
export const RPC_RES_ERROR = `{"id":123,"jsonrpc": "2.0","error":{"code":1,"message":"ExampleMethodresultismissing'example_key'."}}`;

/**
 * Given a nock scope, make it only resolve to requests
 * matching HOPRd's message API.
 * @param nock
 */
export const nockSendMessageApi = (nock: Nock.Scope): Nock.Interceptor => {
  return nock.post((uri) => uri.includes("/api/v2/messages"));
};
