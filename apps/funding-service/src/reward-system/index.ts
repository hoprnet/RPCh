/**
 * Functions related to querying a GraphQL API for ticket redemption data.
 */
import { gql } from "graphql-request";
import fetch from "node-fetch";
import { createLogger } from "../utils";
import * as constants from "../constants";

const log = createLogger(["reward-system-graph-api"]);
let lastBlockNumber = 0;

/**
 * GraphQL query to get the latest block number
 */
const getLastBlockNumberQuery = gql`
  query getLastBlockNumber {
    _meta {
      block {
        number
      }
    }
  }
`;

/**
 * GraphQL query to get the total number of redeemed tickets for a given set of accounts
 */
const getNewRedeemedTicketsQuery = gql`
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

/**
 * GraphQL query to get the total number of redeemed tickets from a given block onwards and set of accounts
 * @param blockNumber - The last block number queried
 * @param ids - An array of entry node IDs to query for
 * @returns The total redeemed ticket counts by source account ID and the last block number queried
 */
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
        query: getNewRedeemedTicketsQuery,
        variables,
      }),
    });

    const graphRes = await ticketCounts.json();
    lastBlockNumber = graphRes.data._meta.block.number;

    const totalRedeemedTicketCountBySourceId: { [key: string]: number } =
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
    // FIXME: This could return `undefined`. Check if this could lead to bugs
    return totalRedeemedTicketCountBySourceId;
  } catch (e) {
    log.error(["Error querying the graph", e]);
  }
};

/**
 * Gets the latest block number by querying the GraphQL API
 * @returns The latest block number
 */
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

/**
 * Queries the GraphQL API for the total number of redeemed tickets for a predefined set of accounts
 * @returns The total redeemed ticket counts by source account ID and the last block number queried
 */
export const ticketsIssued = async (): Promise<{ [key: string]: number }> => {
  if (lastBlockNumber === 0) {
    lastBlockNumber = await getLastBlockNumber();
  }

  // GET NODES FROM DP
  const nodes = [
    "0xbfdbe0e896c989b23d6ca83e12ad4df1739b6e28",
    "0x5c5369a112b60fd3c35b46bbae41ca246de31010",
    "0x4b93f77871b237030f0d2ea78bd898e2072ea714",
  ];
  // If getRedeemedTicketCount returns `undefined` we want to
  // still use the present block number of the moment
  let prevBlockNum = lastBlockNumber;
  const redeemedTicketCountBySourceId = await getRedeemedTicketCount(
    lastBlockNumber,
    nodes
  );

  if (!redeemedTicketCountBySourceId) {
    lastBlockNumber = prevBlockNum;
    throw new Error("Could not retrieve redemeed ticket count");
  }

  return redeemedTicketCountBySourceId;
};
