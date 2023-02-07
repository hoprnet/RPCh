import * as db from "../db";
import { randomWords } from "../utils";
import { CreateClient, QueryClient } from "./dto";

const AMOUNT_OF_RANDOM_WORDS_FOR_TRIAL_ID = 5;

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
  const randomWordsId = randomWords(AMOUNT_OF_RANDOM_WORDS_FOR_TRIAL_ID).join(
    "-"
  );

  const dbQuota: CreateClient = {
    id: randomWordsId,
    payment: "trial",
    labels: labels ?? [],
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
