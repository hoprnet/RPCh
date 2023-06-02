import { utils } from "@rpch/common";
import { type RegisteredNodeDB, type RegisteredNode } from "./db";

/** Generic logger for this project */
export const createLogger = utils.LoggerFactory("availability-monitor");

/** Transform a DB node object to a normalized node objected */
export function fromDbNode(node: RegisteredNodeDB): RegisteredNode {
  return {
    hasExitNode: node.has_exit_node,
    peerId: node.id,
    chainId: node.chain_id,
    hoprdApiEndpoint: node.hoprd_api_endpoint,
    hoprdApiToken: node.hoprd_api_token,
    exitNodePubKey: node.exit_node_pub_key,
    nativeAddress: node.native_address,
  };
}
