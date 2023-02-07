import * as db from "../db";
import { CreateClient, QueryClient } from "./dto";

export const createClient = async (
  dbInstance: db.DBInstance,
  client: CreateClient
): Promise<QueryClient> => {
  const dbQuota: CreateClient = {
    id: client.id,
    payment: client.payment,
    labels: client.labels ?? [],
  };
  return await db.createClient(dbInstance, dbQuota);
};

export const getClient = async (
  dbInstance: db.DBInstance,
  id: string
): Promise<QueryClient | null> => {
  return await db.getClient(dbInstance, id);
};

export const updateClient = async (
  dbInstance: db.DBInstance,
  client: QueryClient
): Promise<QueryClient | null> => {
  return await db.updateClient(dbInstance, client);
};

export const deleteClient = async (
  dbInstance: db.DBInstance,
  id: string
): Promise<QueryClient | null> => {
  return await db.deleteClient(dbInstance, id);
};
