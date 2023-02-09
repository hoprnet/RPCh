import { Wallet, Contract, providers, BigNumber, utils } from "ethers";
import { createLogger } from "./utils";

const log = createLogger(["fund-via-wallet"]);

/**
 * Fund a recipient using a wallet.
 * @param privateKey
 * @param provider
 * @param hoprTokenAddress
 * @param nativeAmount
 * @param hoprAmount
 * @param recipient
 */
export default async function main(
  privateKey: string,
  providerStr: string,
  hoprTokenAddress: string,
  nativeAmountStr: string,
  hoprAmountStr: string,
  recipient: string
): Promise<void> {
  log.normal("Funding via wallet", {
    provider: providerStr,
    hoprTokenAddress,
    nativeAmount: nativeAmountStr,
    hoprAmount: hoprAmountStr,
    recipient,
  });

  const provider = new providers.JsonRpcProvider(providerStr);
  const wallet = new Wallet(privateKey).connect(provider);

  // check if wallet has enough balance to do transactions
  const walletBalance = await wallet.getBalance();
  if (walletBalance.lt(utils.parseEther("0.1"))) {
    throw Error("Wallet balance is less than 0.1");
  }

  const nativeAmount = BigNumber.from(nativeAmountStr);
  const hoprAmount = BigNumber.from(hoprAmountStr);

  if (nativeAmount.gt(0)) {
    log.verbose(
      `We want the recipient balance to be at least '${nativeAmount.toString()}' NATIVE`
    );

    const balance = await provider.getBalance(recipient);
    const remaining = nativeAmount.sub(balance);
    const needs = remaining.gt(0) ? remaining : BigNumber.from(0);
    log.verbose(
      `Recipient balance is '${balance.toString()}' NATIVE and needs '${needs.toString()}' NATIVE`
    );

    if (needs.gt(0)) {
      // check if balance has enough balanace
      if (needs.gt(await wallet.getBalance())) {
        throw Error(`Wallet balance is less than ${needs.toString()} NATIVE`);
      }

      log.normal(`Funding recipient with '${nativeAmount}' NATIVE`);
      const tx = await wallet.sendTransaction({
        to: recipient,
        value: needs,
      });
      await tx.wait(2);
      log.normal(
        `Funded recipeint with '${nativeAmount}' NATIVE in '${tx.hash}'`
      );
    }
  }

  if (hoprAmount.gt(0)) {
    log.verbose(
      `We want the recipient balance to be at least '${hoprAmount.toString()}' HOPR`
    );

    const abi = [
      "function transfer(address to, uint amount) returns (bool)",
      "function balanceOf(address) view returns (uint)",
    ];
    const tokenContract = new Contract(hoprTokenAddress, abi, wallet);

    const balance = await tokenContract?.balanceOf(recipient);
    const remaining = hoprAmount.sub(balance);
    const needs = remaining.gt(0) ? remaining : BigNumber.from(0);
    log.verbose(
      `Recipient balance is '${balance.toString()}' HOPR and needs '${needs.toString()}' HOPR`
    );

    if (needs.gt(0)) {
      // check if balance has enough balanace
      if (needs.gt(await tokenContract?.balanceOf(wallet.address))) {
        throw Error(`Wallet balance is less than ${needs.toString()} HOPR`);
      }

      log.normal(`Funding recipient with '${hoprAmount}' HOPR`);
      const tx = await tokenContract?.transfer(recipient, needs);
      await tx.wait(2);
      log.normal(`Funded '${hoprAmount}' HOPR in '${tx.hash}'`);
    }
  }
}
