import { Wallet, providers, utils } from "ethers";
import fundViaWallet from "./fund-via-wallet";
import { createLogger } from "../utils";

const log = createLogger(["fund-hoprd-nodes"]);

/**
 * Fund HOPRd nodes via a wallet.
 * @param privateKey
 * @param providerStr
 * @param hoprTokenAddress
 * @param nativeAmount
 * @param hoprAmount
 * @param recipients
 */
export default async function main(
  privateKey: string,
  providerStr: string,
  hoprTokenAddress: string,
  nativeAmount: string,
  hoprAmount: string,
  recipients: string[]
): Promise<void> {
  log.normal("Fund HOPRd nodes via wallet", {
    provider: providerStr,
    hoprTokenAddress,
    nativeAmount,
    hoprAmount,
    recipients,
  });

  for (const recipient of recipients) {
    await fundViaWallet(
      privateKey,
      providerStr,
      hoprTokenAddress,
      nativeAmount,
      hoprAmount,
      recipient
    );
  }
}
