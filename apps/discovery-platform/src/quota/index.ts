import * as db from "../db";
import { Quota, QuotaDB } from "../types";

/**
 * Saves a quota in DB
 * @param dbInstance DBInstance
 * @param quota Quota
 * @returns QuotaDB
 */
export const createQuota = async (
  dbInstance: db.DBInstance,
  quota: Quota
): Promise<QuotaDB> => {
  const dbQuota: Quota = {
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
 * @returns QuotaDB
 */
export const getQuota = async (
  dbInstance: db.DBInstance,
  id: number
): Promise<QuotaDB> => {
  return await db.getQuota(dbInstance, id);
};

/**
 * Get all quotas paid by a specific client
 * @param dbInstance DBInstance
 * @param client string
 * @returns QuotaDB[]
 */
export const getQuotasPaidByClient = async (
  dbInstance: db.DBInstance,
  client: string
): Promise<QuotaDB[]> => {
  return await db.getQuotasPaidByClient(dbInstance, client);
};

/**
 * Get all quotas created by a specific client
 * @param dbInstance DBInstance
 * @param client string
 * @returns QuotaDB[]
 */
export const getQuotasCreatedByClient = async (
  dbInstance: db.DBInstance,
  client: string
): Promise<QuotaDB[]> => {
  return await db.getQuotasCreatedByClient(dbInstance, client);
};

/**
 * Update quota in DB with matching id
 * @param dbInstance DBInstance
 * @param quota QuotaDB
 * @returns QuotaDB
 */
export const updateQuota = async (
  dbInstance: db.DBInstance,
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
  dbInstance: db.DBInstance,
  id: number
): Promise<QuotaDB> => {
  return await db.deleteQuota(dbInstance, id);
};

/**
 * Calculate sum on quotas
 * @param quotas QuotaDB[]
 * @returns bigint
 */
export const sumQuotas = (quotas: QuotaDB[]): bigint => {
  const sumOfQuotas = quotas.reduce(
    (prev, next) => BigInt(prev) + BigInt(next.quota),
    BigInt(0)
  );
  return sumOfQuotas;
};
