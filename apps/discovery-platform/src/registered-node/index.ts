import * as db from "../db";
import { CreateRegisteredNode, QueryRegisteredNode } from "./dto";

export const getAllRegisteredNodes = async (
  dbInstance: db.DBInstance
): Promise<QueryRegisteredNode[]> => {
  return await db.getAllRegisteredNodes(dbInstance);
};

export const createRegisteredNode = async (
  dbInstance: db.DBInstance,
  node: CreateRegisteredNode
): Promise<boolean> => {
  const newNode = {
    registeredAt: new Date(Date.now()),
    honestyScore: 0,
    totalAmountFunded: 0,
    status: "FRESH",
    chainId: Number(node.chainId),
    hasExitNode: Boolean(node.hasExitNode),
    peerId: node.peerId,
  } as QueryRegisteredNode;

  return await db.saveRegisteredNode(dbInstance, newNode);
};

export const getRegisteredNode = async (
  dbInstance: db.DBInstance,
  peerId: string
): Promise<QueryRegisteredNode | undefined> => {
  const node = await db.getRegisteredNode(dbInstance, peerId);
  return node;
};

export const updateRegisteredNode = async (
  dbInstance: db.DBInstance,
  updatedNode: QueryRegisteredNode
): Promise<boolean> => {
  return await db.updateRegisteredNode(dbInstance, updatedNode);
};

export const getAllExitNodes = async (dbInstance: db.DBInstance) => {
  return await db.getAllExitNodes(dbInstance);
};

export const getAllNonExitNodes = async (dbInstance: db.DBInstance) => {
  return await db.getAllNonExitNodes(dbInstance);
};

export const getSelectedNodeAccessToken = async (dbInstance: db.DBInstance) => {
  const allNodes = await getAllRegisteredNodes(dbInstance);
  const selectedNode = allNodes.at(Math.floor(Math.random() * allNodes.length));
  // TODO: get access token of selected node
  const accessToken = `0x` + selectedNode?.peerId;
  return accessToken;
};
