import { JsonRpcProvider } from "@ethersproject/providers";
import { expect } from "@jest/globals";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  mine,
  setNextBlockBaseFeePerGas,
} from "@nomicfoundation/hardhat-network-helpers";
import assert from "assert";
import { ethers } from "hardhat";
import {
  getBalance,
  getProvider,
  getReceiptOfTransaction,
  sendTransaction,
  waitForTransaction,
} from "./blockchain";

describe("test Blockchain class", function () {
  let accounts: SignerWithAddress[];
  let provider: JsonRpcProvider;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    provider = ethers.provider;
  });

  it("should get balance", async function () {
    const [owner] = accounts;
    const balance = await getBalance(owner.address, provider);
    assert.equal(ethers.utils.formatEther(balance), "10000.0");
  });

  it("should send transaction", async () => {
    const [owner, receiver] = accounts;
    const transactionHash = await sendTransaction({
      from: owner,
      to: receiver.address,
      amount: ethers.utils.parseEther("10").toString(),
    });
    assert.notEqual(transactionHash, undefined);
  });

  it("should check the status of transaction", async function () {
    const [owner, receiver] = accounts;
    const transactionHash = await sendTransaction({
      from: owner,
      to: receiver.address,
      amount: "10",
    });
    const receipt = await getReceiptOfTransaction(provider, transactionHash);
    const possibleStatus = [0, 1];
    expect(possibleStatus).toContain(receipt.status);
  });
  it("should fail if chain is not supported", async function () {
    try {
      await getProvider(-1);
    } catch (e: any) {
      expect(e.message).toBe("Chain not supported");
    }
  });
  it("should return provider if chain is supported", async function () {
    const chainId = 100;
    const provider = await getProvider(chainId);
    const { chainId: actualChainId } = await provider.getNetwork();
    assert.equal(actualChainId, chainId);
  });
  it("should wait for transaction to be confirmed", async function () {
    const [owner, receiver] = accounts;
    const confirmations = 4;
    const transactionHash = await sendTransaction({
      from: owner,
      to: receiver.address,
      amount: "10",
    });
    await mine(confirmations);
    const receipt = await waitForTransaction(
      transactionHash,
      provider,
      confirmations
    );
    assert.equal(receipt.confirmations, confirmations + 1);
  });
  it("should fail because of gasLimit and be able to get the error message", async function () {
    const [owner, receiver] = accounts;
    await setNextBlockBaseFeePerGas(10000);
    try {
      const transactionHash = await sendTransaction({
        from: owner,
        to: receiver.address,
        amount: "10",
        options: {
          gasPrice: 1,
          gasLimit: 1,
        },
      });
      console.log(transactionHash);
    } catch (e: any) {
      expect(e.message).toBe(
        "Transaction gasPrice (1) is too low for the next block, which has a baseFeePerGas of 10000"
      );
    }
  });
  it("should fail because of nonce and be able to get the error message", async function () {
    const [owner, receiver] = accounts;
    await setNextBlockBaseFeePerGas(10000);
    try {
      await sendTransaction({
        from: owner,
        to: receiver.address,
        amount: "10",
        options: {
          nonce: 0,
        },
      });
    } catch (e: any) {
      expect(e.code).toBe("NONCE_EXPIRED");
    }
  });
});
