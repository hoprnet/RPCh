import * as db from "../db";
import { CreateQuota, QueryQuota } from "./dto";

export const createQuota = async (
  dbInstance: db.DBInstance,
  quota: CreateQuota
) => {
  const dbQuota: QueryQuota = {
    id: Math.floor(Math.random() * 6e2),
    action_taker: quota.actionTaker,
    client: quota.client,
    quota: quota.quota,
  };
  return await db.createQuota(dbInstance, dbQuota);
};

export const getQuota = async (dbInstance: db.DBInstance, id: number) => {
  return await db.getQuota(dbInstance, id);
};

export const getAllQuotasByClient = async (
  dbInstance: db.DBInstance,
  client: string
) => {
  return await db.getAllQuotasByClient(dbInstance, client);
};

export const updateQuota = async (
  dbInstance: db.DBInstance,
  quota: QueryQuota
) => {
  return await db.updateQuota(dbInstance, quota);
};

export const deleteQuota = async (dbInstance: db.DBInstance, id: number) => {
  return await db.deleteQuota(dbInstance, id);
};
