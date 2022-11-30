import { AccessToken } from "./access-token";
import { CreateAccessToken } from "./dto";
import { saveAccessToken, getAccessToken, deleteAccessToken } from "../db";
import { DBInstance } from "../index";

const THIRTY_MINUTES = 1;
const MAX_HOPR = 40;

export class AccessTokenService {
  constructor(private db: DBInstance) {}

  public async saveAccessToken() {
    const now = new Date();
    const expiredAt = new Date(
      new Date(now).setMinutes(now.getMinutes() + THIRTY_MINUTES)
    );
    const accessToken = new AccessToken(
      expiredAt,
      MAX_HOPR,
      process.env.SECRET_KEY ?? ""
    );

    const query: CreateAccessToken = {
      Token: accessToken.getHash(),
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
    return getAccessToken(this.db, accessTokenHash);
  }

  public deleteAccessToken(accessTokenHash: string) {
    return deleteAccessToken(this.db, accessTokenHash);
  }
}
