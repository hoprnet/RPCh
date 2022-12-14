import { ethers } from "ethers";

export const isExpired = (expireAt: string) => {
  if ((new Date(expireAt).valueOf() ?? 0) < new Date(Date.now()).valueOf()) {
    return true;
  }
  return false;
};

export const hardhatChainId = 31337;

export const gnosisChainId = 100;

const productionConnectionInfo: [number, ethers.utils.ConnectionInfo][] = [
  [100, { url: "https://rpc.gnosischain.com/" }],
];
const developmentConnectionInfo: [number, ethers.utils.ConnectionInfo][] = [
  [hardhatChainId, { url: "http://localhost:8545" }],
];

export type ValidConnectionInfo = Map<number, ethers.utils.ConnectionInfo>;

export const validConnectionInfo: ValidConnectionInfo = new Map<
  number,
  ethers.utils.ConnectionInfo
>(
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  process.env.NODE_ENV === "production"
    ? productionConnectionInfo
    : developmentConnectionInfo
);

export class CustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomError";
  }
}
