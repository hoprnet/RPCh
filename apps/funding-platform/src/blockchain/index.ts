import { ethers, providers, Signer, Wallet } from "ethers";
import { hardhatChainId } from "../utils";

export const chainIds = new Map<number, ethers.utils.ConnectionInfo>([
  [100, { url: "https://rpc.gnosischain.com/" }],
  [hardhatChainId, { url: "http://localhost:8545" }],
]);

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

export const getProvider = (chainId: number) => {
  if (!chainIds.has(chainId)) throw new Error("Chain not supported");
  const provider = new ethers.providers.JsonRpcProvider(chainIds.get(chainId));
  return provider;
};

export const getProviders = (chainIds: number[]) => {
  const providers = [];
  for (const chainId of chainIds) {
    const provider = getProvider(chainId);
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
  const balances: { [chainId: number]: string } = {};
  for (const provider of providers) {
    const balance = await getBalance(address, provider);
    balances[provider.network.chainId] = balance.toString();
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
