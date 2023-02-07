import retry from "async-retry";
import {
  createLogger,
  getBalances,
  getHoprTokenAddress,
  withdraw,
} from "./utils";

const log = createLogger(["fund-via-hoprd"]);

/**
 * Fund a wallet through a HOPRd node.
 * @param hoprdEndpoint
 * @param hoprdToken
 * @param nativeAmount
 * @param hoprAmount
 * @param recipient
 */
export default async function main(
  hoprdEndpoint: string,
  hoprdToken: string,
  nativeAmount: string,
  hoprAmount: string,
  recipient: string
): Promise<void> {
  log.normal("Funding via HOPRd", {
    hoprdEndpoint,
    hoprdToken,
    nativeAmount,
    hoprAmount,
  });

  // keep retrying until node has been funded
  await retry(
    async (bail) => {
      log.verbose("Trying to get balances");
      const balances = await getBalances(hoprdEndpoint, hoprdToken);

      if (Number(balances.native) > 0 && Number(balances.hopr) > 0) {
        return true;
      } else {
        log.verbose("Not funded yet");
        bail(new Error("Node has not been funded"));
      }
    },
    {
      retries: 10,
    }
  );

  const hoprTokenAddress = await getHoprTokenAddress(hoprdEndpoint, hoprdToken);
  log.normal("HoprToken address is", hoprTokenAddress);

  const nativeTxHash = await withdraw(
    hoprdEndpoint,
    hoprdToken,
    "NATIVE",
    nativeAmount,
    recipient
  );
  log.normal(`Funded ${nativeAmount} NATIVE in ${nativeTxHash}`);

  const hoprTxHash = await withdraw(
    hoprdEndpoint,
    hoprdToken,
    "HOPR",
    hoprAmount,
    recipient
  );
  log.normal(`Funded ${hoprAmount} HOPR in ${hoprTxHash}`);
}
