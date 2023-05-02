import { utils } from "ethers";
import * as crypto from "@rpch/crypto-for-nodejs";
import Request from "./request";
import Response from "./response";
import type { IMemoryDb } from "pg-mem";

// example of a working provider
export const PROVIDER = "https://primary.gnosis-chain.rpc.hoprtech.net";

export const HOPRD_PEER_ID_A =
  "16Uiu2HAmA5h2q7G2RrZMA4znAH4p8KBcuJWUmjjVfpW5DXePQ2He";
export const HOPRD_PUB_KEY_A =
  "0x02d9c0e0ab99d251a8fd2cd48df6554dfd5112afe589a3dcab75928aea34f98581";
export const HOPRD_PRIV_KEY_A =
  "0xd12c951563ee7e322562b7ce7a31c37cc6c10d9b86f834ed30f7c4ab42ae8de0";

// NOTICE: this is a HOPRd PeerID
export const EXIT_NODE_HOPRD_PEER_ID_A =
  "16Uiu2HAkwJdCap1ErGKjtLeHjfnN53TD8kryG48NYVPWx4HhRfKW";
export const EXIT_NODE_PUB_KEY_A =
  "0x021d5401d6fa65591e4a08a2fdff6c7687f1de5a2326ed8ade69b69e6fe9b9d59f";
export const EXIT_NODE_PRIV_KEY_A =
  "0xf49d5b21d9363ff94f9e4c7a575c2bdf6229893ad58f23c9ade02b29e1f3fba1";

export const EXIT_NODE_WRITE_IDENTITY_A = crypto.Identity.load_identity(
  utils.arrayify(EXIT_NODE_PUB_KEY_A),
  utils.arrayify(EXIT_NODE_PRIV_KEY_A)
);
export const EXIT_NODE_READ_IDENTITY_A = crypto.Identity.load_identity(
  utils.arrayify(EXIT_NODE_PUB_KEY_A)
);

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

export const ENCODED_HOPRD_MESSAGE = `249,1,150,185,1,140,52,124,57,54,50,54,48,54,124,53,124,55,124,50,97,56,51,49,51,100,48,50,55,55,102,48,51,102,51,97,100,51,54,50,52,48,54,54,100,48,100,101,98,102,102,101,52,97,97,52,55,55,51,48,99,53,102,102,56,48,100,52,99,102,50,51,53,98,50,49,48,51,99,102,48,54,51,49,55,53,53,99,50,100,101,56,102,98,49,100,97,97,51,98,48,49,54,99,54,54,52,49,57,100,55,97,48,52,55,55,102,55,53,97,50,50,54,102,51,56,55,53,97,50,57,99,100,52,51,101,49,100,51,49,53,48,48,52,99,100,54,97,49,51,48,56,100,50,100,100,50,49,98,55,54,53,98,101,97,49,102,101,48,50,57,56,100,49,97,54,54,100,57,101,99,54,102,98,98,49,97,53,52,98,48,101,100,98,49,56,99,48,98,98,53,98,48,97,54,56,102,54,56,53,56,55,54,98,98,57,49,57,50,102,53,56,55,55,48,56,53,102,101,57,55,52,55,55,51,54,57,51,99,54,52,53,97,50,100,50,99,97,51,51,101,53,48,102,55,53,50,97,56,97,98,54,101,53,55,102,55,51,50,97,51,100,50,98,99,101,49,52,52,102,99,100,52,52,52,56,99,49,49,99,56,102,98,49,53,57,57,98,49,101,97,53,100,100,99,99,52,49,102,99,98,57,56,97,98,55,101,56,100,53,49,55,57,102,57,101,53,52,54,101,98,100,101,55,102,52,56,56,48,48,101,100,55,102,52,102,101,98,50,97,48,52,50,98,101,57,98,56,51,49,56,97,53,50,52,52,52,52,50,56,100,53,99,52,52,102,56,101,102,97,57,53,53,102,52,50,54,51,57,53,55,48,49,54,56,98,49,48,53,57,98,99,134,1,135,205,141,225,198`;

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
export async function* createMockedFlow(
  requestBody: string = RPC_REQ_SMALL
): AsyncGenerator<Request | Response, Response, any> {
  const tmsp = +new Date();
  const TIME_DIFF = 50;
  const entryNodeDestination = HOPRD_PEER_ID_A;
  const exitNodeDestination = EXIT_NODE_HOPRD_PEER_ID_A;
  const exitNodeWriteIdentity = EXIT_NODE_WRITE_IDENTITY_A;
  const exitNodeReadIdentity = EXIT_NODE_READ_IDENTITY_A;
  let resetDateNow: ReturnType<typeof setDateNow>;

  // client side
  resetDateNow = setDateNow(tmsp - TIME_DIFF * 4);
  const clientRequest = await Request.createRequest(
    crypto,
    PROVIDER,
    requestBody,
    entryNodeDestination,
    exitNodeDestination,
    exitNodeReadIdentity
  );
  resetDateNow();
  const lastRequestFromClient: number = (yield clientRequest) || 0;

  // exit node side
  resetDateNow = setDateNow(tmsp - TIME_DIFF * 3);
  const exitNodeRequest = await Request.fromMessage(
    crypto,
    clientRequest.toMessage(),
    exitNodeDestination,
    exitNodeWriteIdentity,
    BigInt(lastRequestFromClient),
    () => {}
  );
  resetDateNow();
  const responseBody: string = (yield exitNodeRequest) || RPC_RES_SMALL;

  // exit node side
  resetDateNow = setDateNow(tmsp - TIME_DIFF * 2);
  const exitNodeResponse = await Response.createResponse(
    crypto,
    exitNodeRequest,
    responseBody
  );
  resetDateNow();
  const lastResponseFromExitNode: number = (yield exitNodeResponse) || 0;

  // client side
  resetDateNow = setDateNow(tmsp - TIME_DIFF);
  const clientResponse = await Response.fromMessage(
    crypto,
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
export async function generateMockedFlow(
  steps: 1 | 2 | 3,
  requestBody: string = RPC_REQ_SMALL,
  lastRequestFromClient: number = 0,
  responseBody: string = RPC_RES_SMALL,
  lastResponseFromExitNode: number = 0
): Promise<
  [
    clientRequest: Request,
    exitNodeRequest: Request,
    exitNodeResponse: Response,
    clientResponse: Response
  ]
> {
  const X = {} as any;
  const flow = createMockedFlow(requestBody);

  const clientRequest = (await flow.next()).value as Request;
  if (steps === 1) return [clientRequest, X, X, X];

  const exitNodeRequest = (await flow.next(lastRequestFromClient))
    .value as Request;
  if (steps === 2) return [clientRequest, exitNodeRequest, X, X];

  const exitNodeResponse = (await flow.next(responseBody)).value as Response;
  if (steps === 3) return [clientRequest, exitNodeRequest, exitNodeResponse, X];

  const clientResponse = (await flow.next(lastResponseFromExitNode))
    .value as Response;

  return [clientRequest, exitNodeRequest, exitNodeResponse, clientResponse];
}

/**
 * Create a key val store with async methods.
 * Used to mock storage operations.
 */
export const createAsyncKeyValStore = () => {
  const store = new Map<string, string>();

  return {
    async set(k: string, v: string) {
      return store.set(k, v);
    },
    async get(k: string) {
      return store.get(k);
    },
  };
};

/**
 * Function to handle numerics with a scale for pg-mem
 * @param db a pg-mem DB instance
 */
export const withQueryIntercept = (instance: IMemoryDb): void => {
  instance.public.interceptQueries((sql: string) => {
    const newSql = sql.replace(/\bnumeric\s*\(\s*\d+\s*,\s*\d+\s*\)/g, "float");
    if (sql !== newSql) {
      return instance.public.many(newSql);
    }
    // proceed to actual SQL execution for other requests.
    return null;
  });
};
