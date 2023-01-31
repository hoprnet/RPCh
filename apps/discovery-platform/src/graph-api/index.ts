import { gql } from "graphql-request";
import fetch from "node-fetch";
import { QueryRegisteredNode } from "../registered-node/dto";
import { GetAccountChannelsResponse } from "./dto";
import { createLogger } from "../utils";
import * as constants from "../constants";

const log = createLogger(["graph-api"]);

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
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    log.verbose("skip check commitment", constants.SKIP_CHECK_COMMITMENT);
    // Assume node has committed to hopr if it is running in development
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (constants.SKIP_CHECK_COMMITMENT) return true;

    const variables = {
      id: ops.node.id,
    };
    // make query
    const channels = await fetch(constants.SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: getCommitmentQuery,
        variables,
      }),
    });

    const graphRes: GetAccountChannelsResponse = await channels.json();

    log.verbose([
      "Received information from the graph",
      JSON.stringify(graphRes),
    ]);

    // check if it has enough balance and enough open channels
    if (validateNode(graphRes, ops.minBalance, ops.minChannels)) {
      return true;
    }

    return false;
  } catch (e) {
    log.error(["Error querying the graph", e]);
  }
};

/**
 * checks if a node has a minimum balance in all open channels, also checks if user has more
 * than a minimum amount of open channels
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
    const channels = await fetch(constants.SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: getAccountsFromBlockChange,
        variables,
      }),
    });

    const graphRes: GetAccountChannelsResponse = await channels.json();

    log.verbose([
      "Received information from the graph",
      JSON.stringify(graphRes),
    ]);

    return graphRes;
  } catch (e) {
    log.error(["Error querying the graph", e]);
  }
};
