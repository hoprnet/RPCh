import { ethers, providers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const sendTransaction = async (params: {
  owner: SignerWithAddress;
  to: string;
  amount: string;
}) => {
  const txParams = {
    to: params.to,
    value: ethers.utils.parseEther(params.amount),
  };

  const transaction = await params.owner.sendTransaction(txParams);

  return transaction.hash;
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
