import { Wallet, Contract, providers, utils } from "ethers";
import { createLogger } from "./utils";

const log = createLogger(["register-hoprd-nodes"]);

/**
 * Register HOPRd nodes.
 * 1. checks if NFT has already been staked
 * 2. if not, checks the NFTs of 'privateKey' and stakes one
 * 3. registers 'peerIds'
 * @param privateKey
 * @param provider
 * @param peerIds
 */
export default async function main(
  privateKey: string,
  providerStr: string,
  nftAddress: string,
  nftId: string,
  stakeAddress: string,
  registerAddress: string,
  peerIds: string[]
): Promise<void> {
  log.normal("Register HOPRd nodes", {
    provider: providerStr,
    nftAddress,
    nftId,
    stakeAddress,
    registerAddress,
    peerIds,
  });

  const provider = new providers.JsonRpcProvider(providerStr);
  const wallet = new Wallet(privateKey).connect(provider);

  // check if wallet has enough balance to do transactions
  const walletBalance = await wallet.getBalance();
  if (walletBalance.lt(utils.parseEther("0.1"))) {
    throw Error("Wallet balance is less than 0.1");
  }

  const nftContract = getNFTAddress(nftAddress).connect(wallet);
  const stakeContract = getStakeContract(stakeAddress).connect(wallet);
  const registerContract = getRegisterContract(registerAddress).connect(wallet);

  // check which peerids are not registered
  const unregisteredPeerIds: string[] = [];
  for (const peerId of peerIds) {
    log.verbose(`Checking if '${peerId}' is registered`);
    const registered = await registerContract?.isNodeRegisteredAndEligible(
      peerId
    );
    log.verbose(`Node '${peerId}' is${registered ? "" : " not"} registered`);
    if (!registered) unregisteredPeerIds.push(peerId);
  }
  log.verbose(`We need to register '${unregisteredPeerIds.length}' nodes`);
  if (unregisteredPeerIds.length === 0) return;

  // check if NFT is already staked
  const isStakedAlready = await stakeContract?.isNftTypeAndRankRedeemed2(
    nftId,
    "developer",
    wallet.address
  );
  if (isStakedAlready) {
    log.verbose(`NFT '${nftId}' is already staked`);
  } else {
    log.verbose(`NFT '${nftId}' is not staked`);

    const hasNFT = await nftContract?.ownerOf(nftId);
    if (!hasNFT) {
      const error = `Private key does not have NFT '${nftId}', aborting registration`;
      log.error(error);
      throw Error(error);
    }

    // stake NFT
    log.verbose(`Staking NFT '${nftId}' by transfering it to stake contract`);
    const tx = await nftContract?.safeTransferFrom(
      wallet.address,
      stakeAddress,
      nftId
    );
    await tx.wait(2);
    log.normal(`Staked NFT '${nftId}'`);
  }

  // register peerids
  log.verbose(`Registering '${unregisteredPeerIds.length}' nodes`);
  const tx = await registerContract?.selfRegister(unregisteredPeerIds);
  await tx.wait(2);
  log.normal(`Registered '${unregisteredPeerIds.length}' nodes`);
}

function getNFTAddress(address: string): Contract {
  const abi = [
    "function safeTransferFrom(address,address,uint256)",
    "function ownerOf(uint256)",
  ];
  return new Contract(address, abi);
}

function getStakeContract(address: string): Contract {
  const abi = [
    "function isNftTypeAndRankRedeemed2(uint256,string,address) view returns (bool)",
  ];
  return new Contract(address, abi);
}

function getRegisterContract(address: string): Contract {
  const abi = [
    "function isNodeRegisteredAndEligible(string) view returns (bool)",
    "function selfRegister(string[])",
  ];
  return new Contract(address, abi);
}
