import { DBInstance, saveRegisteredNode } from "../db";
import { getAllRegisteredNodes as getAllRegisteredNodesDB } from "../db";
import { CreateRegisteredNode, QueryRegisteredNode } from "./dto";

export const getAllRegisteredNodes = async (db: DBInstance) => {
  return await getAllRegisteredNodesDB(db);
};

export const createRegisteredNode = async (
  db: DBInstance,
  node: CreateRegisteredNode
) => {
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
