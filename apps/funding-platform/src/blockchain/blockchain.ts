import { ethers, providers, Signer, Wallet } from "ethers";

export const chainIds = new Map<number, ethers.utils.ConnectionInfo>([
  [100, { url: "https://rpc.gnosischain.com/" }],
  [31337, { url: "http://localhost:8545" }],
]);

export const sendTransaction = async (params: {
  from: Signer;
  to: string;
  amount: string;
}) => {
  const txParams = {
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

export const getWallet = (
  privateKey: string,
  provider: ethers.providers.JsonRpcProvider
): ethers.Wallet => {
  const wallet = new Wallet(privateKey);
  const connectedWallet = wallet.connect(provider);
  return connectedWallet;
};

export const getBalance = (
  address: string,
  provider: ethers.providers.JsonRpcProvider
) => {
  return provider.getBalance(address);
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
