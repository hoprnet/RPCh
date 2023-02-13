import retry from "async-retry";
import { getAddresses, openChannel } from "../hoprd";
import { createLogger } from "../utils";

const log = createLogger(["open-channels"]);

async function openChannels(
  hoprAmount: string,
  hoprdApiEndpoint: string,
  hoprdApiToken: string,
  counterparties: string[]
): Promise<void> {
  log.verbose(`Open channels for '${hoprdApiEndpoint}'`, {
    hoprAmount,
    hoprdApiEndpoint,
    hoprdApiToken,
    counterparties,
  });

  for (const counterparty of counterparties) {
    log.verbose(`Open channel from '${hoprdApiEndpoint}' to '${counterparty}'`);
    await retry(
      async function attemptToOpenChannel() {
        await openChannel(
          hoprdApiEndpoint,
          hoprdApiToken,
          hoprAmount,
          counterparty
        );
      },
      {
        retries: 5,
      }
    );
  }
}

export default async function main(
  hoprAmount: string,
  hoprdApiEndpoints: string[],
  hoprdApiTokens: string[]
): Promise<void> {
  log.normal("Open channels", {
    hoprAmount,
    hoprdApiEndpoints,
    hoprdApiTokens,
  });

  if (hoprdApiEndpoints.length !== hoprdApiTokens.length) {
    throw Error(
      `Length of 'hoprdApiEndpoints'='${hoprdApiEndpoints.length}' does not match length of 'hoprdApiTokens'='${hoprdApiTokens.length}'`
    );
  }

  const groups: {
    hoprdApiEndpoint: string;
    hoprdApiToken: string;
    hoprdPeerId: string;
  }[] = [];

  // get PeerIds in parallel and fill in groups object
  await Promise.all(
    hoprdApiEndpoints.map(async (hoprdApiEndpoint, index) => {
      const hoprdApiToken = hoprdApiTokens[index];
      const hoprdPeerId = await getAddresses(
        hoprdApiEndpoint,
        hoprdApiToken
      ).then((res) => res.hopr);
      groups.push({ hoprdApiEndpoint, hoprdApiToken, hoprdPeerId });
    })
  );

  // initiate channel opening for all nodes in parallel
  await Promise.all(
    groups.map((grp) =>
      openChannels(
        hoprAmount,
        grp.hoprdApiEndpoint,
        grp.hoprdApiToken,
        // filter out self and get list of counterparties
        groups
          .map((grp2) => grp2.hoprdPeerId)
          .filter((hoprdPeerId) => hoprdPeerId !== grp.hoprdPeerId)
      )
    )
  );
}
