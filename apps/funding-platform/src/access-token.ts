import { createHmac } from "crypto";

export default class AccessToken {
  private issuedAt: Date;
  constructor(
    private expireAt: Date,
    private amount: number,
    private secretKey: string
  ) {
    this.issuedAt = new Date();
  }
  public toString(): string {
    const message = {
      issuedAt: this.issuedAt.valueOf(),
      expireAt: this.expireAt,
      amount: this.amount,
    };
    const accessToken = createHmac("sha256", this.secretKey)
      .update(JSON.stringify(message))
      .digest("base64");
    return accessToken;
  }
  public validate(token: string, message: string) {}
}
