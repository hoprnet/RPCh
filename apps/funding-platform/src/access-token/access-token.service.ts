import {
  DBInstance,
  deleteAccessToken as deleteAccessTokenDB,
  getAccessToken as getAccessTokenDB,
  saveAccessToken,
} from "../db";
import type { CreateAccessToken } from "./dto";
import { generateAccessToken } from "./access-token";

const MOCK_MAX_AMOUNT = 20;
const MOCK_SECRET_KEY = "SECRET_KEY";
const MOCK_ACCESS_TOKEN_PARAMS = {
  amount: MOCK_MAX_AMOUNT,
  expiredAt: new Date(Date.now()),
  secretKey: MOCK_SECRET_KEY,
};

export class AccessTokenService {
  constructor(private db: DBInstance, private secretKey: string) {}

  public async createAccessToken(ops: { timeout: number; amount: number }) {
    const now = new Date(Date.now());
    const expiredAt = new Date(
      new Date(now).setMinutes(now.getMinutes() + ops.timeout)
    );

    const hash = generateAccessToken(MOCK_ACCESS_TOKEN_PARAMS);

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
