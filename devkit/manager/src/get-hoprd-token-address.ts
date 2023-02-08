import { createLogger, getInfo } from "./utils";

const log = createLogger(["get-hoprd-token-address"]);

/**
 * Get HOPRd info.
 * @param hoprdEndpoint
 * @param hoprdToken
 * @return HOPR Token address
 */
export default async function main(
  hoprdEndpoint: string,
  hoprdToken: string
): Promise<string> {
  log.normal("Getting HOPRd info", {
    hoprdEndpoint,
    hoprdToken,
  });

  const info = await getInfo(hoprdEndpoint, hoprdToken);
  return info.hoprToken;
}
