import { utils } from "@rpch/common";
import { words } from "./words";
import { RegisteredNodeDB } from "../types";
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

/**
 * Convert a node's endpoint to a locally available one.
 * Used when running in sandbox since by default all endpoint
 * are accessible within docker only.
 */
export const toLocalhostEndpoint = (
  node: RegisteredNodeDB
): RegisteredNodeDB => {
  const url = new URL(node.hoprd_api_endpoint);
  url.hostname = "127.0.0.1";
  node.hoprd_api_endpoint = url.toString();
  return node;
};
