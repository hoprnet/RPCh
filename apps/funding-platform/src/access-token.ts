import { createHmac, randomInt } from "crypto";

export default class AccessToken {
  private createdAt: Date;
  constructor(
    private expiredAt: Date,
    private amount: number,
    private secretKey: string
  ) {
    this.createdAt = new Date();
  }

  public getCreatedAt() {
    return this.createdAt;
  }

  public toString(): string {
    const message = {
      entropy: randomInt(1e6),
      createdAt: this.createdAt.valueOf(),
      expiredAt: this.expiredAt.valueOf(),
      amount: this.amount,
    };
    const accessToken = createHmac("sha256", this.secretKey)
      .update(JSON.stringify(message))
      .digest("base64");
    return accessToken;
  }
}
