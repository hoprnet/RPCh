import { CreateAccessToken, QueryAccessToken } from "../access-token";
import { CreateRequest, QueryRequest, UpdateRequest } from "../request";
import pgp from "pg-promise";
import { createLogger } from "../utils";
import migrate from "node-pg-migrate";
import path from "path";

/**
 * DB module that handles the formatting of queries and executing them
 */

const log = createLogger(["db"]);

export type DBInstance = pgp.IDatabase<{}>;

export const runMigrations = async (dbUrl: string) => {
  const migrationsDirectory = path.join(__dirname, "../../migrations");

  await migrate({
    schema: "public",
    direction: "up",
    count: Infinity,
    databaseUrl: dbUrl,
    migrationsTable: "migrations",
    verbose: true,
    dir: migrationsDirectory,
  });
};

export const saveAccessToken = async (
  db: DBInstance,
  accessToken: CreateAccessToken
): Promise<QueryAccessToken> => {
  const text =
    "INSERT INTO access_tokens(id, token, expired_at) values(default, $<token>, $<expiredAt>) RETURNING *";
  const values = {
    token: accessToken.token,
    expiredAt: accessToken.expiredAt,
  };
  const dbRes: QueryAccessToken = await db.one(text, values);
  return dbRes;
};

export const getAccessToken = async (
  db: DBInstance,
  accessTokenHash: string
): Promise<QueryAccessToken | null> => {
  const text = "SELECT * FROM access_tokens WHERE token=$<token>";
  const values = {
    token: accessTokenHash,
  };
  const dbRes: QueryAccessToken | null = await db.oneOrNone(text, values);

  return dbRes;
};

export const deleteAccessToken = async (
  db: DBInstance,
  accessTokenHash: string
): Promise<QueryAccessToken | null> => {
  const text = "DELETE FROM access_tokens WHERE token=$<token> RETURNING *";
  const values = {
    token: accessTokenHash,
  };
  const dbRes: QueryAccessToken | null = await db.oneOrNone(text, values);
  return dbRes;
};

export const saveRequest = async (
  db: DBInstance,
  request: CreateRequest
): Promise<QueryRequest> => {
  const text = `INSERT INTO requests(id, access_token_hash, node_address, amount, chain_id, status)
    values(default, $<token>, $<address>, $<amount>, $<chainId>, $<status>)
    RETURNING *`;
  const values = {
    token: request.accessTokenHash,
    address: request.nodeAddress,
    amount: request.amount,
    chainId: request.chainId,
    status: request.status,
  };
  const dbRes: QueryRequest = await db.one(text, values);
  return dbRes;
};

export const getRequest = async (
  db: DBInstance,
  requestId: number
): Promise<QueryRequest | null> => {
  const text = "SELECT * FROM requests WHERE id=$<id>";
  const values = {
    id: requestId,
  };
  const dbRes: QueryRequest | null = await db.oneOrNone(text, values);

  return dbRes;
};

export const getRequests = async (db: DBInstance): Promise<QueryRequest[]> => {
  const text = "SELECT * FROM requests";
  const dbRes: QueryRequest[] = await db.manyOrNone(text);
  return dbRes;
};

export const getRequestsByAccessToken = async (
  db: DBInstance,
  accessTokenHash: string
): Promise<QueryRequest[]> => {
  const text = "SELECT * FROM requests WHERE access_token_hash=$<token>";
  const values = {
    token: accessTokenHash,
  };
  const dbRes: QueryRequest[] = await db.manyOrNone(text, values);

  return dbRes;
};

export const updateRequest = async (
  db: DBInstance,
  request: UpdateRequest
): Promise<QueryRequest | null> => {
  const text = `UPDATE requests SET 
    access_token_hash=$<accessTokenHash>,
    node_address=$<nodeAddress>,
    amount=$<amount>,
    chain_id=$<chainId>,
    reason=$<reason>,
    transaction_hash=$<transactionHash>,
    status=$<status>
    WHERE id=$<id>`;
  const values: UpdateRequest = {
    id: request.id,
    accessTokenHash: request.accessTokenHash,
    nodeAddress: request.nodeAddress,
    amount: request.amount,
    chainId: request.chainId,
    reason: request.reason,
    transactionHash: request.transactionHash,
    status: request.status,
  };

  const dbRes: QueryRequest | null = await db.oneOrNone(text, values);

  return dbRes;
};

export const deleteRequest = async (
  db: DBInstance,
  requestId: number
): Promise<QueryRequest> => {
  const text = "DELETE FROM requests WHERE id=$<id> RETURNING *";
  const values = {
    id: requestId,
  };
  const dbRes = await db.oneOrNone(text, values);
  return dbRes;
};

export const getOldestFreshRequest = async (
  db: DBInstance
): Promise<QueryRequest | null> => {
  const text = `SELECT * FROM requests
    WHERE status = 'FRESH'
    ORDER BY created_at ASC
    LIMIT 1;`;
  const dbRes: QueryRequest | null = await db.oneOrNone(text);
  return dbRes;
};

export const getAllUnresolvedRequests = async (
  db: DBInstance
): Promise<QueryRequest[]> => {
  const text = `SELECT * FROM requests
    WHERE status IN ('FRESH', 'PROCESSING')`;
  const dbRes: QueryRequest[] = await db.manyOrNone(text);
  return dbRes;
};
