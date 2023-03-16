import {
  Request,
  RequestDB,
  AccessToken,
  AccessTokenDB,
  DBInstance,
  RequestFilters,
} from "../types";
import { createLogger } from "../utils";
import migrate from "node-pg-migrate";
import path from "path";
import { DBTimestamp } from "../types/general";

const log = createLogger(["db"]);

/**
 * Run migrations from project in a connected db
 * @param dbUrl
 */
export const runMigrations = async (dbUrl: string) => {
  const migrationsDirectory = path.join(__dirname, "../../migrations");

  await migrate({
    schema: "public",
    direction: "up",
    count: Infinity,
    databaseUrl: dbUrl,
    migrationsTable: "migrations",
    dir: migrationsDirectory,
  });
};

export const saveAccessToken = async (
  db: DBInstance,
  accessToken: AccessToken
): Promise<AccessTokenDB> => {
  const text =
    "INSERT INTO access_tokens(id, token, expired_at) values(default, $<token>, $<expiredAt>) RETURNING *";
  const values = {
    token: accessToken.token,
    expiredAt: accessToken.expiredAt,
  };
  const dbRes: AccessTokenDB = await db.one(text, values);
  return dbRes;
};

export const getAccessToken = async (
  db: DBInstance,
  accessTokenHash: string
): Promise<AccessTokenDB> => {
  const text = "SELECT * FROM access_tokens WHERE token=$<token>";
  const values = {
    token: accessTokenHash,
  };
  const dbRes: AccessTokenDB = await db.one(text, values);

  return dbRes;
};

export const deleteAccessToken = async (
  db: DBInstance,
  accessTokenHash: string
): Promise<AccessTokenDB> => {
  const text = "DELETE FROM access_tokens WHERE token=$<token> RETURNING *";
  const values = {
    token: accessTokenHash,
  };
  const dbRes: AccessTokenDB = await db.one(text, values);
  return dbRes;
};

export const saveRequest = async (
  db: DBInstance,
  request: Request
): Promise<RequestDB> => {
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
  const dbRes: RequestDB = await db.one(text, values);
  return dbRes;
};

export const getRequest = async (
  db: DBInstance,
  requestId: number
): Promise<RequestDB> => {
  const text = "SELECT * FROM requests WHERE id=$<id>";
  const values = {
    id: requestId,
  };
  const dbRes: RequestDB = await db.one(text, values);

  return dbRes;
};

export const getRequests = async (
  db: DBInstance,
  where?: RequestFilters
): Promise<RequestDB[]> => {
  const baseText = "SELECT * FROM requests";
  let filtersText = [];
  const values: { [key: string]: string } = {};

  for (const key in where) {
    if (key in where) {
      filtersText.push(`${key}=$<${key}>`);
      values[key] = String(where[key as keyof RequestFilters]);
    }
  }

  const sqlText = filtersText.length
    ? baseText + " WHERE " + filtersText.join(" AND ")
    : baseText;

  const dbRes: RequestDB[] = await db.manyOrNone(sqlText, values);
  log.verbose("Registered nodes with filters query DB response", where, dbRes);

  return dbRes;
};

export const getSumOfRequestsByAccessToken = async (
  db: DBInstance,
  accessTokenHash: string
): Promise<bigint> => {
  const text =
    "SELECT SUM(amount) FROM requests WHERE access_token_hash=$<token>";
  const values = {
    token: accessTokenHash,
  };
  const dbRes: { sum: bigint } = await db.one(text, values);

  return BigInt(dbRes.sum);
};

export const updateRequest = async (
  db: DBInstance,
  request: Omit<RequestDB, keyof DBTimestamp>
): Promise<RequestDB> => {
  const text = `UPDATE requests SET 
    access_token_hash=$<access_token_hash>,
    node_address=$<node_address>,
    amount=$<amount>,
    chain_id=$<chain_id>,
    reason=$<reason>,
    transaction_hash=$<transaction_hash>,
    status=$<status>,
    updated_at = $<updated_at>
    WHERE id=$<id>
    RETURNING *`;

  const values: Omit<RequestDB, "created_at"> = {
    id: request.id,
    access_token_hash: request.access_token_hash,
    node_address: request.node_address,
    amount: request.amount,
    chain_id: request.chain_id,
    reason: request.reason,
    transaction_hash: request.transaction_hash,
    status: request.status,
    updated_at: new Date().toISOString(),
  };

  const dbRes: RequestDB = await db.one(text, values);

  return dbRes;
};

export const deleteRequest = async (
  db: DBInstance,
  requestId: number
): Promise<RequestDB> => {
  const text = "DELETE FROM requests WHERE id=$<id> RETURNING *";
  const values = {
    id: requestId,
  };
  const dbRes = await db.oneOrNone(text, values);
  return dbRes;
};

export const getOldestFreshRequest = async (
  db: DBInstance
): Promise<RequestDB> => {
  const text = `SELECT * FROM requests
    WHERE status = 'FRESH'
    ORDER BY created_at ASC
    LIMIT 1;`;
  const dbRes: RequestDB = await db.one(text);
  return dbRes;
};
