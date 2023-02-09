import ethers from "ethers";
import { createLogger } from "./utils";

const log = createLogger(["fund-via-wallet"]);

/**
 * Fund a wallet through another wallet.
 * @param privateKey
 * @param nativeAmount
 * @param hoprAmount
 * @param recipient
 */
export default async function main(
  privateKey: string,
  provider: string,
  hoprTokenAddress: string,
  nativeAmountStr: string,
  hoprAmountStr: string,
  recipient: string
): Promise<void> {
  log.normal("Funding via wallet", {
    provider,
    hoprTokenAddress,
    nativeAmount: nativeAmountStr,
    hoprAmount: hoprAmountStr,
    recipient,
  });

  const wallet = new ethers.Wallet(privateKey).connect(
    new ethers.providers.JsonRpcProvider(provider)
  );

  const nativeAmount = ethers.BigNumber.from(nativeAmountStr);
  const hoprAmount = ethers.BigNumber.from(hoprAmountStr);

  if (nativeAmount.gt(0)) {
    log.verbose(
      `We want the wallet balance to be at least '${nativeAmount.toString()}' NATIVE`
    );

    const balance = await wallet.getBalance();
    const remaining = nativeAmount.sub(balance);
    const needs = remaining.gt(0) ? remaining : ethers.BigNumber.from(0);
    log.verbose(
      `Wallet balance is '${balance.toString()}' NATIVE and needs '${needs.toString()}' NATIVE`
    );

    if (needs.gt(0)) {
      const tx = await wallet.sendTransaction({
        to: recipient,
        value: needs,
      });
      await tx.wait(2);
      log.normal(`Funded '${nativeAmount}' NATIVE in '${tx.hash}'`);
    }
  }

  if (hoprAmount.gt(0)) {
    log.verbose(
      `We want the wallet balance to be at least '${hoprAmount.toString()}' HOPR`
    );

    const abi = [
      "function transfer(address to, uint amount) returns (bool)",
      "function balanceOf(address) view returns (uint)",
    ];
    const tokenContract = new ethers.Contract(hoprTokenAddress, abi, wallet);

    const balance = await wallet.getBalance();
    const remaining = hoprAmount.sub(balance);
    const needs = remaining.gt(0) ? remaining : ethers.BigNumber.from(0);
    log.verbose(
      `Wallet balance is '${balance.toString()}' HOPR and needs '${needs.toString()}' HOPR`
    );

    if (needs.gt(0)) {
      const tx = await tokenContract.transfer(recipient, needs);
      await tx.wait(2);
      log.normal(`Funded '${hoprAmount}' HOPR in '${tx.hash}'`);
    }
  }
}
