import { QueryQuota } from "../quota/dto";
import type { QueryRegisteredNode } from "../registered-node/dto";

export type Data = {
  registeredNodes: QueryRegisteredNode[];
  quotas: QueryQuota[];
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

export const getAllNonExitNodes = async (db: DBInstance) => {
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

export const createQuota = async (
  dbInstance: DBInstance,
  quota: QueryQuota
): Promise<QueryQuota> => {
  await dbInstance.data.quotas.push(quota);
  return quota;
};

export const getQuota = async (
  dbInstance: DBInstance,
  id: number
): Promise<QueryQuota | undefined> => {
  const quota = await dbInstance.data.quotas.find((quota) => quota.id === id);
  return quota;
};

export const getAllQuotasByClient = async (
  dbInstance: DBInstance,
  client: string
): Promise<QueryQuota[]> => {
  const quotas = await dbInstance.data.quotas.filter(
    (quota) => quota.client === client
  );
  return quotas;
};

export const updateQuota = async (
  dbInstance: DBInstance,
  quota: QueryQuota
): Promise<QueryQuota> => {
  dbInstance.data.quotas = dbInstance.data.quotas.map((tempQuota) =>
    tempQuota.id === quota.id ? { ...tempQuota, ...quota } : tempQuota
  );
  return quota;
};

export const deleteQuota = async (
  dbInstance: DBInstance,
  id: number
): Promise<QueryQuota | undefined> => {
  const deletedQuota = dbInstance.data.quotas.find((quota) => quota.id === id);
  dbInstance.data.quotas = dbInstance.data.quotas.filter(
    (quota) => quota.id !== id
  );
  return deletedQuota;
};
