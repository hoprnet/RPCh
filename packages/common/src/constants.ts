import { ethers } from "ethers";

const {
  // Custom chain id to complete funding
  FORCE_CHAIN_ID,
  // Custom chain url that will be used to create the provider to complete funding
  FORCE_RPC_URL,
  // Custom ERC20 contract on custom chain which will be used for funding
  FORCE_SMART_CONTRACT_ADDRESS,
} = process.env;

const GNOSIS_CHAIN_ID = 100;

// A map of connection information for different Ethereum chains.
const CONNECTION_INFO: { [chainId: number]: ethers.utils.ConnectionInfo } = {
  [GNOSIS_CHAIN_ID]: { url: "https://primary.gnosis-chain.rpc.hoprtech.net" },
};

// A map of smart contract addresses for different Ethereum chains.
const SMART_CONTRACTS_PER_CHAIN: { [chainId: number]: string } = {
  [GNOSIS_CHAIN_ID]: "0x66225dE86Cac02b32f34992eb3410F59DE416698",
};

// Override chain ID, RPC URL, and smart contract address if provided.
if (FORCE_CHAIN_ID && FORCE_RPC_URL && FORCE_SMART_CONTRACT_ADDRESS) {
  CONNECTION_INFO[Number(FORCE_CHAIN_ID)] = { url: FORCE_RPC_URL };
  SMART_CONTRACTS_PER_CHAIN[Number(FORCE_CHAIN_ID)] =
    FORCE_SMART_CONTRACT_ADDRESS;
}

export { CONNECTION_INFO };
