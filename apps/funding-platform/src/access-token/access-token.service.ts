import { AccessToken } from "./access-token";
import { CreateAccessToken } from "./dto";
import {
  saveAccessToken,
  getAccessToken as getAccessTokenDB,
  deleteAccessToken as deleteAccessTokenDB,
} from "../db";
import { DBInstance } from "../index";

const THIRTY_MINUTES = 1;
const MAX_HOPR = 40;

export class AccessTokenService {
  constructor(private db: DBInstance) {}

  public async createAccessToken() {
    const now = new Date();
    const expiredAt = new Date(
      new Date(now).setMinutes(now.getMinutes() + THIRTY_MINUTES)
    );
    const accessToken = new AccessToken(
      expiredAt,
      MAX_HOPR,
      process.env.SECRET_KEY ?? ""
    );

    const hash = accessToken.generateHash();

    const query: CreateAccessToken = {
      Token: hash,
      ExpiredAt: expiredAt.toISOString().slice(0, 19).replace("T", " "),
      CreatedAt: accessToken
        .getCreatedAt()
        .toISOString()
        .slice(0, 19)
        .replace("T", " "),
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
