import type { RegisteredNodeDB, RegisteredNode } from "./db";
import type { Result } from "./review";
import * as fixtures from "@rpch/common/build/fixtures";
import { fromDbNode } from "./utils";

// mocked node from DB
export const NODE_A_DB: RegisteredNodeDB = {
  has_exit_node: false,
  id: fixtures.HOPRD_PEER_ID_A,
  chain_id: 100,
  hoprd_api_endpoint: "http://hoprdApiEndpoint",
  hoprd_api_token: "hoprdApiToken",
  exit_node_pub_key: fixtures.HOPRD_PUB_KEY_A,
  native_address: "nativeaddress",
  total_amount_funded: BigInt("0"),
  honesty_score: 0,
  status: "FRESH",
  created_at: new Date("2023-05-08").toUTCString(),
  updated_at: new Date("2023-05-08").toUTCString(),
};

// mocked node
export const NODE_A: RegisteredNode = fromDbNode(NODE_A_DB);

// mocked node's result
export const RESULT_A: Result = {
  hoprdVersion: {
    checkId: "hoprdVersion",
    passed: true,
    value: "1.2.0",
  },
  hoprdHealth: {
    checkId: "hoprdHealth",
    passed: true,
    value: "green",
  },
  hoprdWorkingApiEndpoint: {
    checkId: "hoprdWorkingApiEndpoint",
    passed: true,
    value: "",
  },
  hoprdSSL: {
    checkId: "hoprdSSL",
    passed: true,
    value: "",
  },
  hoprdSendMessage: {
    checkId: "hoprdSendMessage",
    passed: true,
    value: "",
  },
  hoprdEnoughPeers: {
    checkId: "hoprdEnoughPeers",
    passed: true,
    value: "",
  },
  reviewedAt: new Date("2023-05-08").toUTCString(),
  isStable: true,
};
