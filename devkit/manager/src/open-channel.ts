import { createLogger, openChannel } from "./utils";

const log = createLogger(["open-channel"]);

/**
 * Open a channel between two nodes.
 * @param hoprdEndpoint
 * @param hoprdToken
 * @param hoprAmount
 * @param counterpartyPeerId
 */
export default async function main(
  hoprdEndpoint: string,
  hoprdToken: string,
  hoprAmount: string,
  counterpartyPeerId: string
): Promise<void> {
  log.normal("Open channel between two nodes", {
    hoprdEndpoint,
    hoprdToken,
    hoprAmount,
    counterpartyPeerId,
  });

  await openChannel(hoprdEndpoint, hoprdToken, hoprAmount, counterpartyPeerId);
}
