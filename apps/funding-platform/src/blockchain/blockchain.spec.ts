import assert from "assert";
import { expect } from "@jest/globals";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  getBalance,
  getReceiptOfTransaction,
  sendTransaction,
} from "./blockchain";
import { JsonRpcProvider } from "@ethersproject/providers";

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
      owner: owner,
      to: receiver.address,
      amount: "10",
    });
    assert.notEqual(transactionHash, undefined);
  });

  it("should check the status of transaction", async function () {
    const [owner, receiver] = accounts;
    const transactionHash = await sendTransaction({
      owner: owner,
      to: receiver.address,
      amount: "10",
    });
    const receipt = await getReceiptOfTransaction(provider, transactionHash);
    const possibleStatus = [0, 1];
    expect(possibleStatus).toContain(receipt.status);
  });
});
