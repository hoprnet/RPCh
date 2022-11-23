/**
 * Contains various variables used in tests.
 */

import Request from "./request";
import Response from "./response";

export const RPC_REQ_SMALL = `{"id":"1663836360444","jsonrpc":"2.0","method":"eth_chainId","params":[]}`;
export const RPC_REQ_LARGE = `{"id":"1663836360445","jsonrpc":"2.0","method":"eth_chainId","params":["sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample","sample"]}`;

export const HOPRD_REQ_SMALL = `248,82,184,73,123,34,105,100,34,58,34,49,54,54,51,56,51,54,51,54,48,52,52,52,34,44,34,106,115,111,110,114,112,99,34,58,34,50,46,48,34,44,34,109,101,116,104,111,100,34,58,34,101,116,104,95,99,104,97,105,110,73,100,34,44,34,112,97,114,97,109,115,34,58,91,93,125,134,1,131,101,80,232,127`;

export const PEER_ID_A =
  "16Uiu2HAmM9KAPaXA4eAz58Q7Eb3LEkDvLarU4utkyLwDeEK6vM5m";
export const PEER_ID_B =
  "16Uiu2HAmM9KAPaXA4eAz58Q7Eb3LEkDvLarU4utkyL6vM5mwDeEK";

export const PROVIDER = "https://primary.gnosis-chain.rpc.hoprtech.net";

export const TIMEOUT = 10e3;

export const RESPONSE_BODY = "response";

export const RESPONSE_A = new Response(1, RESPONSE_BODY);

export const RESPONSE_B = new Response(2, RESPONSE_BODY);

export const REQUEST_A = new Request(1, PEER_ID_A, PROVIDER, RPC_REQ_SMALL);

export const REQUEST_B = new Request(2, PEER_ID_A, PROVIDER, RPC_REQ_SMALL);

export const MOCK_DISCOVERY_PLATFORM_API_ENDPOINT = "https://localhost:3000";

export const MOCK_RESPONSE_TEXT =
  "e61bbdda74873540c7244fe69c39f54e5270bd46709c1dcb74c8e3afce7b9e616d";

export const MOCK_API_TOKEN = "123456789";

export const MOCK_DESTINATION =
  "16Uiu2HAmM9KAPaXA4eAz58Q7Eb3LEkDvLarU4utkyL6vM5mwDeEK";
