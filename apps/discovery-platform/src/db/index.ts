import type {
  CreateRegisteredNode,
  QueryRegisteredNode,
} from "../registered-node/dto";

export type Data = {
  registeredNodes: QueryRegisteredNode[];
};

export type DBInstance = {
  data: Data;
};

export const getAllRegisteredNodes = async (db: DBInstance) => {
  return db.data.registeredNodes;
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
