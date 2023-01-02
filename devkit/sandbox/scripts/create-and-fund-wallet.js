/**
 * FOR DEVELOPMENT ONLY
 * Creates a random wallet and funds it with NATIVE and HOPR tokens
 * using one of our HOPRd nodes.
 * Prints our the private key of the wallet generated.
 */
const ethers = require("ethers");
const fetch = require("node-fetch");

const {
  RPC_PROVIDER,
  FUNDING_HOPRD_API_ENDPOINT,
  FUNDING_HOPRD_API_TOKEN,
  NATIVE_AMOUNT = "1",
  HOPR_AMOUNT = "1",
} = process.env;

const withdraw = (apiEndpoint, apiToken, currency, amount, recipient) => {
  const url = new URL("/api/v2/account/withdraw", apiEndpoint);
  const headers = {
    "Content-Type": "application/json",
    "Accept-Content": "application/json",
    Authorization: "Basic " + btoa(apiToken),
  };

  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      currency,
      amount,
      recipient,
    }),
  })
    .then((res) => res.json())
    .then((res) => res.receipt);
};

const getHoprTokenAddress = (apiEndpoint, apiToken) => {
  const url = new URL("/api/v2/node/info", apiEndpoint);
  const headers = {
    "Content-Type": "application/json",
    "Accept-Content": "application/json",
    Authorization: "Basic " + btoa(apiToken),
  };

  return fetch(url, {
    method: "GET",
    headers,
  })
    .then((res) => res.json())
    .then((res) => res.hoprToken);
};

const main = async () => {
  console.log("Creating wallet", {
    RPC_PROVIDER,
    FUNDING_HOPRD_API_ENDPOINT,
    FUNDING_HOPRD_API_TOKEN,
  });

  const hoprTokenAddress = await getHoprTokenAddress(FUNDING_HOPRD_API_TOKEN);
  console.log("HoprToken address is", hoprTokenAddress);

  const provider = new ethers.providers.JsonRpcProvider(RPC_PROVIDER);
  const wallet = ethers.Wallet.createRandom();

  const nativeTxHash = await withdraw(
    FUNDING_HOPRD_API_ENDPOINT,
    FUNDING_HOPRD_API_TOKEN,
    "NATIVE",
    NATIVE_AMOUNT,
    wallet.address
  );
  await provider.waitForTransaction(nativeTxHash);
  console.log(`Funded ${NATIVE_AMOUNT} NATIVE in ${nativeTxHash}`);

  const hoprTxHash = await withdraw(
    FUNDING_HOPRD_API_ENDPOINT,
    FUNDING_HOPRD_API_TOKEN,
    "HOPR",
    HOPR_AMOUNT,
    wallet.address
  );
  await provider.waitForTransaction(hoprTxHash);
  console.log(`Funded ${HOPR_AMOUNT} HOPR in ${hoprTxHash}`);

  return `
    export WALLET_PRIV_KEY="${wallet.privateKey}"
    export SMART_CONTRACT_ADDRESS="${hoprTokenAddress}"
  `;
};

main().then(console.log).catch(console.error);
