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

/**
 * Check if given value is safe as a list input.
 *  - alphanumeric
 *  - commas, dashes, underscores
 * @param value
 * @returns true if safe
 */
export const isListSafe = (value: string): boolean => {
  const regexp = /^[\w\-_,]*$/;
  return regexp.test(value);
};
