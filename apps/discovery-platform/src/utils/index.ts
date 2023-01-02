import { utils } from "@rpch/common";

export const createLogger = utils.LoggerFactory("discovery-platform");

export const isExpired = (expireAt: string) => {
  if ((new Date(expireAt).valueOf() ?? 0) < new Date(Date.now()).valueOf()) {
    return true;
  }
  return false;
};
