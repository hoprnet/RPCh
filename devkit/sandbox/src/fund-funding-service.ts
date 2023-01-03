/**
 * FOR DEVELOPMENT ONLY
 * Creates a random wallet and funds it with NATIVE and HOPR tokens
 * using one of our HOPRd nodes.
 * Prints our the private key of the wallet generated.
 */
import ethers from "ethers";
import fetch from "node-fetch";
import retry from "async-retry";

const {
  RPC_PROVIDER,
  FUNDING_HOPRD_API_ENDPOINT,
  FUNDING_HOPRD_API_TOKEN,
  NATIVE_AMOUNT = "1",
  HOPR_AMOUNT = "1",
} = process.env;

// the address of the private key in `.env`
const RECIPIENT = "0xDb8c54746a26Ab9Ac7ab512B827F6CDb1e555CaE";

if (!RPC_PROVIDER) throw Error("Missing env variable 'RPC_PROVIDER'");
if (!FUNDING_HOPRD_API_ENDPOINT)
  throw Error("Missing env variable 'FUNDING_HOPRD_API_ENDPOINT'");
if (!FUNDING_HOPRD_API_TOKEN)
  throw Error("Missing env variable 'FUNDING_HOPRD_API_TOKEN'");

const headers = {
  "Content-Type": "application/json",
  "Accept-Content": "application/json",
  Authorization: "Basic " + btoa(FUNDING_HOPRD_API_TOKEN),
};

const getBalances = async (): Promise<{ hopr: string; native: string }> => {
  const url = new URL("/api/v2/account/balances", FUNDING_HOPRD_API_ENDPOINT);

  return fetch(url.toString(), {
    method: "GET",
    headers,
  }).then((res) => res.json() as Promise<{ hopr: string; native: string }>);
};

const getHoprTokenAddress = async (): Promise<string> => {
  const url = new URL("/api/v2/node/info", FUNDING_HOPRD_API_ENDPOINT);

  return fetch(url.toString(), {
    method: "GET",
    headers,
  })
    .then((res) => res.json())
    .then((res: any) => res.hoprToken as Promise<string>);
};

const withdraw = async (
  currency: string,
  amount: string,
  recipient: string
): Promise<string> => {
  const url = new URL("/api/v2/account/withdraw", FUNDING_HOPRD_API_ENDPOINT);

  return fetch(url.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      currency,
      amount,
      recipient,
    }),
  })
    .then((res) => res.json())
    .then((res: any) => res.receipt as Promise<string>);
};

const main = async () => {
  console.log("Pre-start", {
    RPC_PROVIDER,
    FUNDING_HOPRD_API_ENDPOINT,
    FUNDING_HOPRD_API_TOKEN,
    NATIVE_AMOUNT,
    HOPR_AMOUNT,
  });

  // keep retrying until node has been funded
  await retry(
    async (bail) => {
      const balances = await getBalances();

      if (Number(balances.native) > 0 && Number(balances.hopr) > 0) {
        return true;
      } else {
        bail(new Error("Node has not been funded"));
      }
    },
    {
      retries: Infinity,
      maxTimeout: 60e3,
    }
  );

  const hoprTokenAddress = await getHoprTokenAddress();
  console.log("HoprToken address is", hoprTokenAddress);

  const provider = new ethers.providers.JsonRpcProvider(RPC_PROVIDER);

  const nativeTxHash = await withdraw("NATIVE", NATIVE_AMOUNT, RECIPIENT);
  await provider.waitForTransaction(nativeTxHash);
  console.log(`Funded ${NATIVE_AMOUNT} NATIVE in ${nativeTxHash}`);

  const hoprTxHash = await withdraw("HOPR", HOPR_AMOUNT, RECIPIENT);
  await provider.waitForTransaction(hoprTxHash);
  console.log(`Funded ${HOPR_AMOUNT} HOPR in ${hoprTxHash}`);

  return hoprTokenAddress;
};

main().then(console.log).catch(console.error);
