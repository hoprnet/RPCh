import * as constants from "../constants";
import * as db from "../db";
import { randomWords } from "../utils";
import { Client, ClientDB } from "../types";

/**
 * Saves a client in DB
 * @param dbInstance DBInstance
 * @param client Client
 * @returns ClientDB
 */
export const createClient = async (
  dbInstance: db.DBInstance,
  client: Client
): Promise<ClientDB> => {
  const dbQuota: Client = {
    id: client.id,
    payment: client.payment,
    labels: client.labels ?? [],
    quotaPaid: client.quotaPaid ?? BigInt(0),
    quotaUsed: client.quotaUsed ?? BigInt(0),
  };
  return await db.createClient(dbInstance, dbQuota);
};

export const createTrialClient = async (
  dbInstance: db.DBInstance,
  labels: string[]
): Promise<ClientDB> => {
  const randomWordsId = randomWords(
    constants.AMOUNT_OF_RANDOM_WORDS_FOR_TRIAL_ID
  ).join("-");

  const dbQuota: Client = {
    id: randomWordsId,
    payment: "trial",
    labels: labels ?? [],
    quotaPaid: BigInt(0),
    quotaUsed: BigInt(0),
  };
  return await db.createClient(dbInstance, dbQuota);
};

/**
 * Get a client that matches id
 * @param dbInstance DBInstance
 * @param id string
 * @returns ClientDB
 */
export const getClient = async (
  dbInstance: db.DBInstance,
  id: string
): Promise<ClientDB> => {
  return await db.getClient(dbInstance, id);
};

/**
 * Update client in DB
 * @param dbInstance DBInstance
 * @param client ClientDB
 * @returns ClientDB
 */
export const updateClient = async (
  dbInstance: db.DBInstance,
  client: ClientDB
): Promise<ClientDB> => {
  return await db.updateClient(dbInstance, client);
};

/**
 * Delete client with matching id
 * @param dbInstance DBInstance
 * @param id string
 * @returns ClientDB
 */
export const deleteClient = async (
  dbInstance: db.DBInstance,
  id: string
): Promise<ClientDB> => {
  return await db.deleteClient(dbInstance, id);
};
