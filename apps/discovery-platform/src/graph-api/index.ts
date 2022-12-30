import { gql } from "graphql-request";
import fetch from "node-fetch";
import { utils } from "rpch-common";
import { QueryRegisteredNode } from "../registered-node/dto";
import { GetAccountChannelsResponse } from "./dto";

const { logVerbose, logError } = utils.createLogger([
  "discovery-platform",
  "graph-api",
]);

const GRAPH_HOPR_URL =
  "https://api.thegraph.com/subgraphs/name/hoprnet/hopr-channels";

/**
 * Query to get info needed to know if a node is committed
 */
const getCommitmentQuery = gql`
  query getAccount($id: String!) {
    account(id: $id) {
      fromChannels(where: { status: OPEN }) {
        id
        balance
      }
    }
  }
`;

/**
 * Query to get initial state / updated state for indexer
 */
const getAccountsFromBlockChange = gql`
  query getAccountsFromBlockChange($blockNumber: Int!) {
    accounts(where: { _change_block: { number_gte: $blockNumber } }) {
      balance
      isActive
      openChannelsCount
      fromChannels {
        status
        redeemedTicketCount
        commitment
        lastOpenedAt
        lastOpenedAt
      }
    }
  }
`;

/**
 * Check commitment for a specific node
 * @param node QueryRegisteredNode
 * @param minBalance Minimum balance needed for node to be considered committed
 * @param minChannels Minimum amount of open channels needed to be considered committed
 * @returns boolean | undefined
 */
export const checkCommitment = async (ops: {
  node: QueryRegisteredNode;
  minBalance: number;
  minChannels: number;
}): Promise<boolean | undefined> => {
  try {
    const variables = {
      id: ops.node.peerId,
    };
    // make query
    const channels = await fetch(GRAPH_HOPR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: getCommitmentQuery,
        variables,
      }),
    });

    const graphRes = (await channels.json()) as GetAccountChannelsResponse;

    logVerbose([
      "Received information from the graph",
      JSON.stringify(graphRes),
    ]);

    // check if it has enough balance and enough open channels
    if (validateNode(graphRes, ops.minBalance, ops.minChannels)) {
      return true;
    }

    return false;
  } catch (e) {
    logError(["Error querying the graph", e]);
  }
};

/**
 *
 * @param graphRes hopr channels subgraph response
 * @param minBalance Minimum balance needed for node to be considered committed
 * @param minChannels Minimum amount of open channels needed to be considered committed
 * @returns boolean
 */
export const validateNode = (
  graphRes: GetAccountChannelsResponse,
  minBalance: number,
  minChannels: number
): boolean => {
  const sumOfBalance = graphRes.data.account.fromChannels.reduce(
    (acc, channel) => acc + channel.balance,
    0
  );
  const amountOfOpenChannels = graphRes.data.account.fromChannels.length;
  return amountOfOpenChannels >= minChannels && sumOfBalance >= minBalance;
};

export const getUpdatedAccounts = async (blockNumber: number) => {
  // make query
  try {
    const variables = {
      blockNumber,
    };
    const channels = await fetch(GRAPH_HOPR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: getAccountsFromBlockChange,
        variables,
      }),
    });

    const graphRes = (await channels.json()) as GetAccountChannelsResponse;

    logVerbose([
      "Received information from the graph",
      JSON.stringify(graphRes),
    ]);

    return graphRes;
  } catch (e) {
    logError(["Error querying the graph", e]);
  }
};
