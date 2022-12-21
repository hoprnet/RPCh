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
 * An RPC response which is an error
 */
export const RPC_RES_ERROR = `{"id":123,"jsonrpc": "2.0","error":{"code":1,"message":"ExampleMethodresultismissing'example_key'."}}`;

/**
 * Adjust global Date.now().
 * Primarily used to avoid verification
 * due to RPCh crypto verification when
 * unit testing Requests and Responses.
 * @param tmsp new timestamp
 * @returns Reset time
 */
export const setDateNow = (tmsp: number): (() => void) => {
  const DateNowOriginal = Date.now;
  Date.now = jest.fn(() => tmsp);
  return () => {
    Date.now = DateNowOriginal;
  };
};

/**
 * Sometimes it makes more sense to simply wait
 * than using `setDateNow`.
 * @param ms
 */
export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A creator function to create a fully
 * mocked request / response flow
 * step by step.
 * @param entryNode
 * @param exitNode
 * @param requestBody
 */
export function* createMockedFlow(
  requestBody: string = RPC_REQ_SMALL
): Generator<Request | Response, Response, any> {
  const tmsp = +new Date();
  const TIME_DIFF = 50;
  const entryNode = IDENTITY_A_NO_PRIV;
  const exitNode = IDENTITY_B_NO_PRIV;
  const exitNodeWithPriv = IDENTITY_B;
  let resetDateNow: ReturnType<typeof setDateNow>;

  // client side
  resetDateNow = setDateNow(tmsp - TIME_DIFF * 4);
  const clientRequest = Request.createRequest(
    PROVIDER,
    requestBody,
    entryNode,
    exitNode
  );
  resetDateNow();
  const lastRequestFromClient: number = (yield clientRequest) || 0;

  // exit node side
  resetDateNow = setDateNow(tmsp - TIME_DIFF * 3);
  const exitNodeRequest = Request.fromMessage(
    clientRequest.toMessage(),
    exitNodeWithPriv,
    BigInt(lastRequestFromClient),
    () => {}
  );
  resetDateNow();
  const responseBody: string = (yield exitNodeRequest) || RPC_RES_SMALL;

  // exit node side
  resetDateNow = setDateNow(tmsp - TIME_DIFF * 2);
  const exitNodeResponse = Response.createResponse(
    exitNodeRequest,
    responseBody
  );
  resetDateNow();
  const lastResponseFromExitNode: number = (yield exitNodeResponse) || 0;

  // client side
  resetDateNow = setDateNow(tmsp - TIME_DIFF);
  const clientResponse = Response.fromMessage(
    clientRequest,
    exitNodeResponse.toMessage(),
    BigInt(lastResponseFromExitNode),
    () => {}
  );
  resetDateNow();
  return clientResponse;
}

/**
 * Generates a whole mocked flow
 * request / response at once.
 * @param steps when to stop generating
 * @param requestBody
 * @param lastRequestFromClient
 * @param responseBody
 * @param lastResponseFromExitNode
 */
export function generateMockedFlow(
  steps: 1 | 2 | 3,
  requestBody: string = RPC_REQ_SMALL,
  lastRequestFromClient: number = 0,
  responseBody: string = RPC_RES_SMALL,
  lastResponseFromExitNode: number = 0
): [
  clientRequest: Request,
  exitNodeRequest: Request,
  exitNodeResponse: Response,
  clientResponse: Response
] {
  const X = {} as any;
  const flow = createMockedFlow(requestBody);

  const clientRequest = flow.next().value as Request;
  if (steps === 1) return [clientRequest, X, X, X];

  const exitNodeRequest = flow.next(lastRequestFromClient).value as Request;
  if (steps === 2) return [clientRequest, exitNodeRequest, X, X];

  const exitNodeResponse = flow.next(responseBody).value as Response;
  if (steps === 3) return [clientRequest, exitNodeRequest, exitNodeResponse, X];

  const clientResponse = flow.next(lastResponseFromExitNode).value as Response;
  return [clientRequest, exitNodeRequest, exitNodeResponse, clientResponse];
}

/**
 * Given a nock scope, make it only resolve to requests
 * matching HOPRd's message API.
 * @param nock
 */
export const nockSendMessageApi = (nock: Nock.Scope): Nock.Interceptor => {
  return nock.post((uri) => uri.includes("/api/v2/messages"));
};
