import * as constants from "../constants";
import * as db from "../db";
import { randomWords } from "../utils";
import { CreateClient, QueryClient } from "./dto";

/**
 * Saves a client in DB
 * @param dbInstance DBInstance
 * @param client CreateClient
 * @returns QueryClient
 */
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

export const createTrialClient = async (
  dbInstance: db.DBInstance,
  labels: string[]
): Promise<QueryClient> => {
  const randomWordsId = randomWords(
    constants.AMOUNT_OF_RANDOM_WORDS_FOR_TRIAL_ID
  ).join("-");

  const dbQuota: CreateClient = {
    id: randomWordsId,
    payment: "trial",
    labels: labels ?? [],
  };
  return await db.createClient(dbInstance, dbQuota);
};

/**
 * Get a client that matches id
 * @param dbInstance DBInstance
 * @param id string
 * @returns QueryClient | null
 */
export const getClient = async (
  dbInstance: db.DBInstance,
  id: string
): Promise<QueryClient | null> => {
  return await db.getClient(dbInstance, id);
};

/**
 * Update client in DB
 * @param dbInstance DBInstance
 * @param client QueryClient
 * @returns QueryClient
 */
export const updateClient = async (
  dbInstance: db.DBInstance,
  client: QueryClient
): Promise<QueryClient | null> => {
  return await db.updateClient(dbInstance, client);
};

/**
 * Delete client with matching id
 * @param dbInstance DBInstance
 * @param id string
 * @returns QueryClient | null
 */
export const deleteClient = async (
  dbInstance: db.DBInstance,
  id: string
): Promise<QueryClient | null> => {
  return await db.deleteClient(dbInstance, id);
};
