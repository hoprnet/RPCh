import * as db from "../db";
import { Quota, QuotaDB, DBInstance } from "../types";

/**
 * Saves a quota in DB
 * @param dbInstance DBInstance
 * @param quota Quota
 * @returns QuotaDB
 */
export const createQuota = async (
  dbInstance: DBInstance,
  quota: Quota
): Promise<QuotaDB> => {
  const dbQuota: Quota = {
    actionTaker: quota.actionTaker,
    clientId: quota.clientId,
    quota: quota.quota,
    paidBy: quota.paidBy,
    token: quota.token,
  };
  return await db.createQuota(dbInstance, dbQuota);
};

/**
 * Get a quota that matches id
 * @param dbInstance DBInstance
 * @param id number
 * @returns QuotaDB
 */
export const getQuota = async (
  dbInstance: DBInstance,
  id: number
): Promise<QuotaDB> => {
  return await db.getQuota(dbInstance, id);
};

/**
 * Get a quota that matches token
 * @param dbInstance DBInstance
 * @param token string
 * @returns QuotaDB
 */
export const getQuotaByToken = async (
  dbInstance: DBInstance,
  token: string
): Promise<QuotaDB> => {
  return await db.getQuotaByToken(dbInstance, token);
};

/**
 * Get sum of quotas paid by a specific client
 * @param dbInstance DBInstance
 * @param client string
 * @returns bigint
 */
export const getSumOfQuotasPaidByClient = async (
  dbInstance: DBInstance,
  client: string
): Promise<bigint> => {
  return await db.getSumOfQuotasPaidByClient(dbInstance, client);
};

/**
 * Get sum of quotas used by a specific client
 * @param dbInstance DBInstance
 * @param client string
 * @returns bigint
 */
export const getSumOfQuotasUsedByClient = async (
  dbInstance: DBInstance,
  client: string
): Promise<bigint> => {
  return await db.getSumOfQuotasUsedByClient(dbInstance, client);
};

/**
 * Update quota in DB with matching id
 * @param dbInstance DBInstance
 * @param quota QuotaDB
 * @returns QuotaDB
 */
export const updateQuota = async (
  dbInstance: DBInstance,
  quota: QuotaDB
): Promise<QuotaDB> => {
  return await db.updateQuota(dbInstance, quota);
};

/**
 * Delete quota with matching id
 * @param dbInstance DBInstance
 * @param id string
 * @returns QuotaDB
 */
export const deleteQuota = async (
  dbInstance: DBInstance,
  id: number
): Promise<QuotaDB> => {
  return await db.deleteQuota(dbInstance, id);
};
