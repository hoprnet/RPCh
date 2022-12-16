import type { QueryRegisteredNode } from "../registered-node/dto";

export type Data = {
  registeredNodes: QueryRegisteredNode[];
};

export type DBInstance = {
  data: Data;
};

export const getAllRegisteredNodes = async (db: DBInstance) => {
  return db.data.registeredNodes;
};

export const getAllExitNodes = async (db: DBInstance) => {
  return db.data.registeredNodes.filter((node) => node.hasExitNode);
};

export const getAllNodesThatAreNotExitNodes = async (db: DBInstance) => {
  return db.data.registeredNodes.filter((node) => !node.hasExitNode);
};

export const saveRegisteredNode = async (
  db: DBInstance,
  node: QueryRegisteredNode
) => {
  try {
    await db.data.registeredNodes.push(node);
    return true;
  } catch (e) {
    return false;
  }
};

export const getRegisteredNode = async (db: DBInstance, peerId: string) => {
  return db.data.registeredNodes.find((node) => node.peerId === peerId);
};

export const updateRegisteredNode = async (
  db: DBInstance,
  updatedNode: QueryRegisteredNode
) => {
  try {
    db.data.registeredNodes = db.data.registeredNodes.map((node) =>
      node.peerId === updatedNode.peerId ? { ...node, ...updatedNode } : node
    );
    return true;
  } catch (e) {
    return false;
  }
};
