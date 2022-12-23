import {
  DBInstance,
  deleteAccessToken as deleteAccessTokenDB,
  getAccessToken as getAccessTokenDB,
  saveAccessToken,
} from "../db";
import type { CreateAccessToken, QueryAccessToken } from "./dto";
import { generateAccessToken } from "./access-token";
import { utils } from "rpch-common";

const { log, logError } = utils.createLogger([
  "funding-platform",
  "access-token-service",
]);

/**
 * An abstraction layer for access tokens to interact with db.
 * @param db holds all methods to interact with db
 * @param secretKey signs access tokens
 */
export class AccessTokenService {
  constructor(private db: DBInstance, private secretKey: string) {}

  /**
   * Saves a access token in DB
   * @param timeout number
   * @param amount amount
   * @returns Promise<QueryRequest | undefined>
   */
  public async createAccessToken(ops: {
    timeout: number;
    amount: number;
  }): Promise<QueryAccessToken | undefined> {
    try {
      log("Creating access token...");
      const now = new Date(Date.now());
      // expiredAt is calculated by adding the minutes set
      // with ops.timeout to the current time
      const expiredAt = new Date(
        new Date(now).setMinutes(now.getMinutes() + ops.timeout)
      );

      const hash = generateAccessToken({
        amount: ops.amount,
        secretKey: this.secretKey,
        expiredAt,
      });

      const query: CreateAccessToken = {
        token: hash,
        expiredAt: expiredAt.toISOString(),
        createdAt: now.toISOString(),
      };

      const queryAccessToken = await saveAccessToken(this.db, query);

      return queryAccessToken;
    } catch (e: any) {
      logError("Failed to create access token: ", e);
    }
  }

  /**
   * Gets access token object from DB with a specific access token hash
   * @param accessTokenHash string
   * @returns Promise<QueryAccessToken | undefined>
   */
  public getAccessToken(
    accessTokenHash: string
  ): Promise<QueryAccessToken | undefined> {
    return getAccessTokenDB(this.db, accessTokenHash);
  }

  /**
   * Deletes access token object from DB with a specific access token hash
   * @param accessTokenHash string
   * @returns Promise<QueryAccessToken | undefined>
   */
  public deleteAccessToken(
    accessTokenHash: string
  ): Promise<QueryAccessToken | undefined> {
    return deleteAccessTokenDB(this.db, accessTokenHash);
  }
}
