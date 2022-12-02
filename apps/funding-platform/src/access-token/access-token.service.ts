import { AccessToken } from "./access-token";
import { CreateAccessToken } from "./dto";
import {
  saveAccessToken,
  getAccessToken as getAccessTokenDB,
  deleteAccessToken as deleteAccessTokenDB,
} from "../db";
import { DBInstance } from "../db";

export class AccessTokenService {
  constructor(private db: DBInstance) {}

  public async createAccessToken(ops: { timeout: number; amount: number }) {
    const now = new Date(Date.now());
    const expiredAt = new Date(
      new Date(now).setMinutes(now.getMinutes() + ops.timeout)
    );
    const accessToken = new AccessToken(
      expiredAt,
      ops.amount,
      process.env.SECRET_KEY ?? ""
    );

    const hash = accessToken.generateHash();

    const query: CreateAccessToken = {
      Token: hash,
      ExpiredAt: expiredAt.toISOString(),
      CreatedAt: accessToken.getCreatedAt().toISOString(),
    };

    await saveAccessToken(this.db, query);

    return accessToken;
  }

  public getAccessToken(accessTokenHash: string) {
    return getAccessTokenDB(this.db, accessTokenHash);
  }

  public deleteAccessToken(accessTokenHash: string) {
    return deleteAccessTokenDB(this.db, accessTokenHash);
  }
}
