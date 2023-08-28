#!/usr/bin/env node
const { Wallet, utils } = require("ethers");

//console.log("generating random wallet");
const wallet = Wallet.createRandom();
const compressedPubkey = utils.computePublicKey(wallet.publicKey, true);
const output = {
  private_key: wallet.privateKey,
  public_key: wallet.publicKey,
  compressed_pubkey: compressedPubkey,
};
console.log(JSON.stringify(output));
