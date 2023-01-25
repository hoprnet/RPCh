import * as db from "../db";
import { CreateRegisteredNode, QueryRegisteredNode } from "./dto";
import { createLogger } from "../utils";
import { utils } from "@rpch/common";

const log = createLogger(["registered-node"]);

/**
 * Saves a registered node in DB
 * @param dbInstance DBinstance
 * @param node CreateRegisteredNode
 * @returns boolean
 */
export const createRegisteredNode = async (
  dbInstance: db.DBInstance,
  node: CreateRegisteredNode
): Promise<boolean> => {
  const newNode: Omit<QueryRegisteredNode, "created_at" | "updated_at"> = {
    honesty_score: 0,
    total_amount_funded: 0,
    status: "FRESH",
    chain_id: Number(node.chainId),
    hoprd_api_endpoint: node.hoprdApiEndpoint,
    hoprd_api_port: node.hoprdApiPort,
    exit_node_pub_key: node.exitNodePubKey,
    native_address: node.nativeAddress,
    has_exit_node: Boolean(node.hasExitNode),
    id: node.peerId,
  };
  log.verbose("Saving new registered node", newNode);

  return await db.saveRegisteredNode(dbInstance, newNode);
};

/**
 * Get a specific registered node
 * @param dbInstance DBinstance
 * @param peerId id of the node
 * @returns QueryRegisteredNode | undefined
 */
export const getRegisteredNode = async (
  dbInstance: db.DBInstance,
  peerId: string
): Promise<QueryRegisteredNode | null> => {
  const node = await db.getRegisteredNode(dbInstance, peerId);
  return node;
};

/**
 * Update a registered node in DB
 * @param dbInstance DBinstances
 * @param updatedNode node with updated values
 * @returns boolean
 */
export const updateRegisteredNode = async (
  dbInstance: db.DBInstance,
  updatedNode: QueryRegisteredNode
): Promise<boolean> => {
  return await db.updateRegisteredNode(dbInstance, updatedNode);
};

/**
 * get node that will be used for that request
 * @param dbInstance DBinstance
 * @param filters possible ways to filter registered nodes
 * @returns access token hash
 */
export const getEligibleNode = async (
  dbInstance: db.DBInstance,
  filters?: db.RegisteredNodeFilters
): Promise<QueryRegisteredNode | undefined> => {
  const readyNodes = await getRegisteredNodes(dbInstance, {
    ...filters,
    status: "READY",
  });
  // choose selected entry node
  const selectedNode = utils.randomlySelectFromArray(readyNodes);
  // TODO: get access token of selected node
  return selectedNode;
};

/**
 * Calculate the reward that a given node should receive
 * @param baseQuota how much quota did the node allow
 * @param node node that gave access for request
 * @returns number
 */
export const getRewardForNode = (
  baseQuota: number,
  baseExtra: number,
  node: QueryRegisteredNode
): number => {
  const extra = node.has_exit_node ? baseExtra * 2 : baseExtra;
  const reward = baseQuota + extra;
  return reward;
};

/**
 * Get all registered nodes with an optional set of filters
 * @param dbInstance DBinstance
 * @param filters possible ways to filter registered nodes
 * @returns QueryRegisteredNode[]
 */
export const getRegisteredNodes = async (
  dbInstance: db.DBInstance,
  filters?: db.RegisteredNodeFilters
): Promise<QueryRegisteredNode[]> => {
  return await db.getRegisteredNodes(dbInstance, filters);
};
