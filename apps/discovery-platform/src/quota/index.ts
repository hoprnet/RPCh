import * as db from "../db";
import { CreateQuota, QueryQuota } from "./dto";

/**
 * Saves a quota in DB
 * @param dbInstance DBInstance
 * @param quota CreateQuota
 * @returns QueryQuota
 */
export const createQuota = async (
  dbInstance: db.DBInstance,
  quota: CreateQuota
): Promise<QueryQuota> => {
  const dbQuota: CreateQuota = {
    actionTaker: quota.actionTaker,
    client: quota.client,
    quota: quota.quota,
  };
  return await db.createQuota(dbInstance, dbQuota);
};

/**
 * Get a quota that matches id
 * @param dbInstance DBInstance
 * @param id string
 * @returns QueryQuota | undefined
 */
export const getQuota = async (
  dbInstance: db.DBInstance,
  id: number
): Promise<QueryQuota | undefined> => {
  return await db.getQuota(dbInstance, id);
};

/**
 * Get all quotas created for a specific client
 * @param dbInstance DBInstance
 * @param client string
 * @returns QueryQuota[]
 */
export const getAllQuotasByClient = async (
  dbInstance: db.DBInstance,
  client: string
): Promise<QueryQuota[]> => {
  return await db.getQuotasByClient(dbInstance, client);
};

/**
 * Update quota in DB with matching id
 * @param dbInstance DBInstance
 * @param quota QueryQuota
 * @returns QueryQuota
 */
export const updateQuota = async (
  dbInstance: db.DBInstance,
  quota: QueryQuota
): Promise<QueryQuota> => {
  return await db.updateQuota(dbInstance, quota);
};

/**
 * Delete quota with matching id
 * @param dbInstance DBInstance
 * @param id string
 * @returns QueryQuota | undefined
 */
export const deleteQuota = async (
  dbInstance: db.DBInstance,
  id: number
): Promise<QueryQuota | undefined> => {
  return await db.deleteQuota(dbInstance, id);
};

/**
 * Calculate sum on quotas
 * @param quotas QueryQuota[]
 * @returns number
 */
export const sumQuotas = (quotas: QueryQuota[]): number => {
  const sumOfQuotas = quotas.reduce((prev, next) => prev + next.quota, 0);
  return sumOfQuotas;
};
