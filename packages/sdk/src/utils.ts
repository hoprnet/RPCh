import { utils } from "@rpch/common";

export const createLogger = utils.LoggerFactory("sdk");

export function shortPeerId(peerId: string): string {
  return `p..${peerId.substring(peerId.length - 4)}`;
}
