import { utils } from "@rpch/common";

export const createLogger = utils.LoggerFactory("sdk");

export function shortPeerId(peerId: string): string {
  return `.${peerId.substring(peerId.length - 4)}`;
}
