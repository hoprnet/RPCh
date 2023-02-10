import { Contract } from "ethers";
import { utils } from "@rpch/common";

export const createLogger = utils.LoggerFactory("sandbox");

/**
 * Get an instance of the smart contract.
 * @notice Does not support the full ABI
 * @param address
 * @returns instance of the smart contract
 */
export function getNFTAddress(address: string): Contract {
  const abi = [
    "function safeTransferFrom(address,address,uint256)",
    "function ownerOf(uint256)",
  ];
  return new Contract(address, abi);
}

/**
 * Get an instance of the smart contract.
 * @notice Does not support the full ABI
 * @param address
 * @returns instance of the smart contract
 */
export function getStakeContract(address: string): Contract {
  const abi = [
    "function isNftTypeAndRankRedeemed2(uint256,string,address) view returns (bool)",
  ];
  return new Contract(address, abi);
}

/**
 * Get an instance of the smart contract.
 * @notice Does not support the full ABI
 * @param address
 * @returns instance of the smart contract
 */
export function getRegisterContract(address: string): Contract {
  const abi = [
    "function isNodeRegisteredAndEligible(string) view returns (bool)",
    "function selfRegister(string[])",
  ];
  return new Contract(address, abi);
}
