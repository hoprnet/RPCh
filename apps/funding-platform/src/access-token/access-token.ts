import { createHmac, randomInt } from "crypto";

export const generateAccessToken = (params: {
  expiredAt: Date;
  amount: number;
  secretKey: string;
}): string => {
  const createdAt = new Date(Date.now());
  const message = {
    entropy: randomInt(1e6),
    createdAt: createdAt.valueOf(),
    expiredAt: params.expiredAt.valueOf(),
    amount: params.amount,
  };
  const accessToken = createHmac("sha256", params.secretKey)
    .update(JSON.stringify(message))
    .digest("base64");
  return accessToken;
};
