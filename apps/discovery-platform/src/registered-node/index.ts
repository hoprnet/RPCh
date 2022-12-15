import {
  DBInstance,
  getAllRegisteredNodes as getAllRegisteredNodesDB,
  saveRegisteredNode,
  getRegisteredNode as getRegisteredNodeDB,
  updateRegisteredNode as updateRegisteredNodeDB,
} from "../db";
import { CreateRegisteredNode, QueryRegisteredNode } from "./dto";

export const getAllRegisteredNodes = async (
  db: DBInstance
): Promise<QueryRegisteredNode[]> => {
  return await getAllRegisteredNodesDB(db);
};

export const createRegisteredNode = async (
  db: DBInstance,
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

  return await saveRegisteredNode(db, newNode);
};

export const getRegisteredNode = async (
  db: DBInstance,
  peerId: string
): Promise<QueryRegisteredNode | undefined> => {
  const node = await getRegisteredNodeDB(db, peerId);
  return node;
};

export const updateRegisteredNode = async (
  db: DBInstance,
  updatedNode: QueryRegisteredNode
): Promise<boolean> => {
  return await updateRegisteredNodeDB(db, updatedNode);
};
