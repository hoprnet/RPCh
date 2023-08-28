#!/usr/bin/env node
const { Wallet, utils } = require("ethers");

console.log("generating random wallet");
const wallet = Wallet.createRandom();
const compressedPubkey = utils.computePublicKey(wallet.publicKey, true);
console.log("privkey", wallet.privateKey);
console.log("compressedPubkey", compressedPubkey);
