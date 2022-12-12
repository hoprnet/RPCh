import {
  DBInstance,
  deleteAccessToken as deleteAccessTokenDB,
  getAccessToken as getAccessTokenDB,
  saveAccessToken,
} from "../db";
import type { CreateAccessToken } from "./dto";
import { generateAccessToken } from "./access-token";

/**
 * An abstraction layer for access tokens to interact with db.
 * @param db holds all methods to interact with db
 * @param secretKey signs access tokens
 */
export class AccessTokenService {
  constructor(private db: DBInstance, private secretKey: string) {}

  public async createAccessToken(ops: { timeout: number; amount: number }) {
    const now = new Date(Date.now());
    const expiredAt = new Date(
      new Date(now).setMinutes(now.getMinutes() + ops.timeout)
    );

    const hash = generateAccessToken({
      amount: ops.amount,
      secretKey: this.secretKey,
      expiredAt,
    });

    const query: CreateAccessToken = {
      Token: hash,
      ExpiredAt: expiredAt.toISOString(),
      CreatedAt: now.toISOString(),
    };

    await saveAccessToken(this.db, query);

    return query;
  }

  public getAccessToken(accessTokenHash: string) {
    return getAccessTokenDB(this.db, accessTokenHash);
  }

  public deleteAccessToken(accessTokenHash: string) {
    return deleteAccessTokenDB(this.db, accessTokenHash);
  }
}
