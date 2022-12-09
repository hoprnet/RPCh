import { ethers, providers, Signer, Wallet } from "ethers";
import { hardhatChainId } from "../utils";

const productionChainIds: [number, ethers.utils.ConnectionInfo][] = [
  [100, { url: "https://rpc.gnosischain.com/" }],
];
const developmentChainIds: [number, ethers.utils.ConnectionInfo][] = [
  [hardhatChainId, { url: "http://localhost:8545" }],
];
export const chainIds = new Map<number, ethers.utils.ConnectionInfo>(
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  process.env.NODE_ENV === "production"
    ? productionChainIds
    : developmentChainIds
);

export const sendTransaction = async (params: {
  from: Signer;
  to: string;
  amount: string;
  options?: ethers.providers.TransactionRequest;
}) => {
  const txParams = {
    ...params.options,
    to: params.to,
    value: params.amount,
  };

  const transaction = await params.from.sendTransaction(txParams);

  return transaction.hash;
};

export const getProvider = async (chainId: number) => {
  if (!chainIds.has(chainId)) throw new Error("Chain not supported");
  const provider = new ethers.providers.JsonRpcProvider(chainIds.get(chainId));
  return provider;
};

export const getProviders = async (chainIds: number[]) => {
  const providers = [];
  for (const chainId of chainIds) {
    const provider = await getProvider(chainId);
    providers.push(provider);
  }
  return providers;
};

export const getWallet = (
  privateKey: string,
  provider?: ethers.providers.JsonRpcProvider
): ethers.Wallet => {
  let wallet = new Wallet(privateKey);
  if (provider) {
    wallet = wallet.connect(provider);
  }
  return wallet;
};

export const getBalance = (
  address: string,
  provider: ethers.providers.JsonRpcProvider
) => {
  return provider.getBalance(address);
};

export const getBalanceForAllChains = async (
  address: string,
  providers: ethers.providers.JsonRpcProvider[]
) => {
  const balances: { [chainId: number]: number } = {};
  for (const provider of providers) {
    const balance = await getBalance(address, provider);
    balances[provider.network.chainId] = Number(balance.toString());
  }
  return balances;
};

export const getReceiptOfTransaction = async (
  provider: ethers.providers.JsonRpcProvider,
  transactionHash: string
) => {
  const reciept = await provider.getTransactionReceipt(transactionHash);
  return reciept;
};

export const waitForTransaction = (
  transactionHash: string,
  provider: ethers.providers.Provider,
  confirmations: number
) => {
  return provider.waitForTransaction(transactionHash, confirmations);
};
