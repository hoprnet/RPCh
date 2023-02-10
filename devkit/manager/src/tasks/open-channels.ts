import fetch from "node-fetch";
import retry from "async-retry";
import { utils } from "@rpch/common";
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
  hoprdApiEndpoint1: string,
  hoprdApiToken1: string,
  hoprdApiEndpoint2: string,
  hoprdApiToken2: string,
  hoprdApiEndpoint3: string,
  hoprdApiToken3: string,
  hoprdApiEndpoint4: string,
  hoprdApiToken4: string,
  hoprdApiEndpoint5: string,
  hoprdApiToken5: string
): Promise<void> {
  log.normal("Open channels", {
    hoprAmount,
    hoprdApiEndpoint1,
    hoprdApiToken1,
    hoprdApiEndpoint2,
    hoprdApiToken2,
    hoprdApiEndpoint3,
    hoprdApiToken3,
    hoprdApiEndpoint4,
    hoprdApiToken4,
    hoprdApiEndpoint5,
    hoprdApiToken5,
  });
  const groupsNoPeerId: {
    hoprdApiEndpoint: string;
    hoprdApiToken: string;
  }[] = [
    {
      hoprdApiEndpoint: hoprdApiEndpoint1,
      hoprdApiToken: hoprdApiToken1,
    },
    {
      hoprdApiEndpoint: hoprdApiEndpoint2,
      hoprdApiToken: hoprdApiToken2,
    },
    {
      hoprdApiEndpoint: hoprdApiEndpoint3,
      hoprdApiToken: hoprdApiToken3,
    },
    {
      hoprdApiEndpoint: hoprdApiEndpoint4,
      hoprdApiToken: hoprdApiToken4,
    },
    {
      hoprdApiEndpoint: hoprdApiEndpoint5,
      hoprdApiToken: hoprdApiToken5,
    },
  ];

  // get the peerids of the nodes
  const hoprdPeerIds = await Promise.all(
    groupsNoPeerId.map((grp) =>
      getAddresses(grp.hoprdApiEndpoint, grp.hoprdApiToken).then(
        (res) => res.hopr
      )
    )
  );

  const groups = groupsNoPeerId.map((grp, index) => ({
    ...grp,
    hoprPeerId: hoprdPeerIds[index],
  }));

  await Promise.all(
    groups.map((grp) =>
      openChannels(
        hoprAmount,
        grp.hoprdApiEndpoint,
        grp.hoprdApiToken,
        // filter out self and get list of counterparties
        groups
          .map((grp2) => grp2.hoprPeerId)
          .filter((hoprPeerId) => hoprPeerId !== grp.hoprPeerId)
      )
    )
  );
}
