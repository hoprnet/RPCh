import { ethers, Signer, Wallet, Contract } from "ethers";
import { validChainIds } from "../utils";
import * as erc20 from "./erc20-fixture.json";

export const sendTransaction = async (params: {
  smartContractAddress: string;
  from: Signer;
  to: string;
  amount: string;
}): Promise<ethers.providers.TransactionResponse> => {
  const contract = new Contract(
    params.smartContractAddress,
    erc20.abi,
    params.from
  );

  const txParams = [params.to, params.amount];

  const transactionResponse = await contract.transfer(...txParams);

  return transactionResponse;
};

export const getProvider = async (chainId: number) => {
  if (!validChainIds.has(chainId)) throw new Error("Chain not supported");
  const provider = new ethers.providers.JsonRpcProvider(
    validChainIds.get(chainId)
  );
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
  smartContractAddress: string,
  walletAddress: string,
  provider: ethers.providers.Provider
) => {
  const contract = new ethers.Contract(
    smartContractAddress,
    erc20.abi,
    provider
  );
  const balance = contract.balanceOf(walletAddress);
  return balance;
};

export const getBalanceForAllChains = async (
  smartContractAddresses: { [chainId: number]: string },
  walletAddress: string,
  providers: ethers.providers.JsonRpcProvider[]
) => {
  const balances: { [chainId: number]: number } = {};
  for (const provider of providers) {
    const balance = await getBalance(
      smartContractAddresses[provider.network.chainId],
      walletAddress,
      provider
    );
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
): Promise<ethers.providers.TransactionReceipt> => {
  return provider.waitForTransaction(transactionHash, confirmations);
};
