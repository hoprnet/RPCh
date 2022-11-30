import { AccessToken } from "./access-token";
import { DBInterface } from "../db";
import { CreateAccessToken } from "./dto";

const THIRTY_MINUTES = 30;
const MAX_HOPR = 40;

export class AccessTokenService {
  constructor(private db: DBInterface) {}

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
      Token: accessToken.toString(),
      ExpiredAt: expiredAt.toISOString().slice(0, 19).replace("T", " "),
      CreatedAt: accessToken
        .getCreatedAt()
        .toISOString()
        .slice(0, 19)
        .replace("T", " "),
    };

    await this.db.saveAccessToken(query);

    return accessToken;
  }

  public getAccessToken(accessTokenHash: string) {
    return this.db.getAccessToken(accessTokenHash);
  }

  public deleteAccessToken(accessTokenHash: string) {
    return this.db.deleteAccessToken(accessTokenHash);
  }
}
