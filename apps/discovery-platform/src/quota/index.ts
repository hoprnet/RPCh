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
    clientId: quota.clientId,
    quota: quota.quota,
    paidBy: quota.paidBy,
  };
  return await db.createQuota(dbInstance, dbQuota);
};

/**
 * Get a quota that matches id
 * @param dbInstance DBInstance
 * @param id string
 * @returns QueryQuota | null
 */
export const getQuota = async (
  dbInstance: db.DBInstance,
  id: number
): Promise<QueryQuota | null> => {
  return await db.getQuota(dbInstance, id);
};

/**
 * Get all quotas paid by a specific client
 * @param dbInstance DBInstance
 * @param client string
 * @returns QueryQuota[]
 */
export const getQuotasPaidByClient = async (
  dbInstance: db.DBInstance,
  client: string
): Promise<QueryQuota[]> => {
  return await db.getQuotasPaidByClient(dbInstance, client);
};

/**
 * Get all quotas created by a specific client
 * @param dbInstance DBInstance
 * @param client string
 * @returns QueryQuota[]
 */
export const getQuotasCreatedByClient = async (
  dbInstance: db.DBInstance,
  client: string
): Promise<QueryQuota[]> => {
  return await db.getQuotasCreatedByClient(dbInstance, client);
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
): Promise<QueryQuota | null> => {
  return await db.updateQuota(dbInstance, quota);
};

/**
 * Delete quota with matching id
 * @param dbInstance DBInstance
 * @param id string
 * @returns QueryQuota | null
 */
export const deleteQuota = async (
  dbInstance: db.DBInstance,
  id: number
): Promise<QueryQuota | null> => {
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
