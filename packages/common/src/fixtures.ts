import type Nock from "nock";
// import Request from "./request";
// import Response from "./response";
import { Identity } from "./crypto";

/**
 * An RPC provider
 */
export const PROVIDER = "https://primary.gnosis-chain.rpc.hoprtech.net";

export const PRIV_KEY_A =
  "0xd12c951563ee7e322562b7ce7a31c37cc6c10d9b86f834ed30f7c4ab42ae8de0";
export const PRIV_KEY_B =
  "0x1a7a8c37e30c97ebf532042bdc37fe724a3950b0cd7ea5a57c9f3e30c53c44a3";

export const PUB_KEY_A =
  "0x02d9c0e0ab99d251a8fd2cd48df6554dfd5112afe589a3dcab75928aea34f98581";
export const PUB_KEY_B =
  "0x021be92a59234dbef617f5eb0d5426758a6cad16f951458a3d753aa22c09e75509";

export const PEER_ID_A =
  "16Uiu2HAmA5h2q7G2RrZMA4znAH4p8KBcuJWUmjjVfpW5DXePQ2He";
export const PEER_ID_B =
  "16Uiu2HAkwJdCap1ErGKjtLeHjfnN53TD8kryG48NYVPWx4HhRfKW";

export const IDENTITY_A = new Identity(PEER_ID_A, PRIV_KEY_A);
export const IDENTITY_B = new Identity(PEER_ID_B, PRIV_KEY_B);

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

// export const SMALL_REQUEST = Request.createRequest(
//   PROVIDER,
//   RPC_REQ_SMALL,
//   IDENTITY_A,
//   IDENTITY_B
// );
// export const LARGE_REQUEST = Request.createRequest(
//   PROVIDER,
//   RPC_REQ_LARGE,
//   IDENTITY_A,
//   IDENTITY_B
// );

// export const SMALL_RESPONSE = Response.fromRequest(
//   SMALL_REQUEST,
//   RPC_RES_SMALL
// );
// export const LARGE_RESPONSE = Response.fromRequest(
//   LARGE_REQUEST,
//   RPC_RES_LARGE
// );

/**
 * An RPC response which is an error
 */
export const RPC_RES_ERROR = `{"id":123,"jsonrpc": "2.0","error":{"code":1,"message":"ExampleMethodresultismissing'example_key'."}}`;

export const nockSendMessageApi = (nock: Nock.Scope): Nock.Interceptor => {
  return nock.post((uri) => uri.includes("/api/v2/messages"));
};
