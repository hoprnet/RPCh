import { createHmac, randomInt } from "crypto";

export class AccessToken {
  private hash?: string;
  private createdAt: Date;
  constructor(
    private expiredAt: Date,
    private amount: number,
    private secretKey: string
  ) {
    this.createdAt = new Date(Date.now());
  }

  public getCreatedAt() {
    return this.createdAt;
  }

  public getExpiredAt() {
    return this.expiredAt;
  }

  public getHash() {
    return this.hash;
  }

  public generateHash(): string {
    const message = {
      entropy: randomInt(1e6),
      createdAt: this.createdAt.valueOf(),
      expiredAt: this.expiredAt.valueOf(),
      amount: this.amount,
    };
    const accessToken = createHmac("sha256", this.secretKey)
      .update(JSON.stringify(message))
      .digest("base64");
    this.hash = accessToken;
    return accessToken;
  }
}
