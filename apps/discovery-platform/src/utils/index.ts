import { utils } from "@rpch/common";
import { words } from "./words";
export const createLogger = utils.LoggerFactory("discovery-platform");

export const isExpired = (expireAt: string) => {
  if ((new Date(expireAt).valueOf() ?? 0) < new Date(Date.now()).valueOf()) {
    return true;
  }
  return false;
};

export const randomWords = (num: number): string[] => {
  return Array.from({ length: num }).map(() =>
    utils.randomlySelectFromArray(words)
  );
};
