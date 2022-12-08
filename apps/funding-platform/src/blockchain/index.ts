import { ethers, providers, Signer, Wallet } from "ethers";

export const chainIds = new Map<number, ethers.utils.ConnectionInfo>([
  [100, { url: "https://rpc.gnosischain.com/" }],
  [31337, { url: "http://localhost:8545" }],
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

export const getProvider = async (chainId: number) => {
  if (!chainIds.has(chainId)) throw new Error("Chain not supported");
  const provider = new ethers.providers.JsonRpcProvider(chainIds.get(chainId));
  return provider;
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
