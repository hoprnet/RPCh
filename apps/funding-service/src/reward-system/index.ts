import { gql } from "graphql-request";
import fetch from "node-fetch";
import { createLogger } from "../utils";
import * as constants from "../constants";
const log = createLogger(["reward-system-graph-api"]);
let lastBlockNumber = 0;

const getLastBlockNumberQuery = gql`
  query getLastBlockNumber {
    _meta {
      block {
        number
      }
    }
  }
`;

const getNewTicketsQuery = gql`
  query getAccountsFromBlockChange($blockNumber: Int!, $ids: [String!]) {
    channels(
      block: { number_gte: $blockNumber }
      where: { source_: { id_in: $ids } }
    ) {
      source {
        id
      }
      destination {
        id
      }
      redeemedTicketCount
      status
    }
    _meta {
      block {
        number
        timestamp
      }
    }
  }
`;

const getRedeemedTicketCount = async (blockNumber: number, ids: String[]) => {
  try {
    const variables = {
      blockNumber,
      ids,
    };
    const ticketCounts = await fetch(constants.SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        query: getNewTicketsQuery,
        variables,
      }),
    });

    const graphRes = await ticketCounts.json();
    const lastBlockNumber = graphRes.data._meta.block.number;

    const totalRedeemedTicketCountBySourceId =
      await graphRes.data.channels.reduce(
        (acc: { [key: string]: number }, ticket: any) => {
          const sourceId = ticket.source.id;
          const redeemedTicketCount = +ticket.redeemedTicketCount;

          if (acc[sourceId]) {
            acc[sourceId] += redeemedTicketCount;
          } else {
            acc[sourceId] = redeemedTicketCount;
          }
          return acc;
        },
        {}
      );

    return [await totalRedeemedTicketCountBySourceId, await lastBlockNumber];
  } catch (e) {
    log.error(["Error querying the graph", e]);
  }
};

const getLastBlockNumber = async (): Promise<number> => {
  const blockNumber = await fetch(constants.SUBGRAPH_URL, {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({ query: getLastBlockNumberQuery }),
  });

  const graphRes = await blockNumber.json();
  return graphRes.data._meta.block.number;
};

export const ticketsIssued = async () => {
  if (lastBlockNumber === 0) {
    lastBlockNumber = await getLastBlockNumber();
  }

  // GET NODES FROM DP
  const nodes = [
    "0xbfdbe0e896c989b23d6ca83e12ad4df1739b6e28",
    "0x5c5369a112b60fd3c35b46bbae41ca246de31010",
    "0x4b93f77871b237030f0d2ea78bd898e2072ea714",
  ];

  // return await getRedeemedTicketCount(lastBlockNumber, nodes);
  console.log(await getRedeemedTicketCount(lastBlockNumber, nodes));
};

ticketsIssued();
