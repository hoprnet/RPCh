import { gql, rawRequest, request } from "graphql-request";
import { QueryRegisteredNode } from "../registered-node/dto";
import { GetAccountChannelsResponse } from "./dto";
import { utils } from "rpch-common";
import fetch from "node-fetch";

const { logVerbose, logError } = utils.createLogger([
  "discovery-platform",
  "graph-api",
]);

const GRAPH_HOPR_URL =
  "https://api.thegraph.com/subgraphs/name/hoprnet/hopr-channels";

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

export const checkCommitment = async (ops: {
  node: QueryRegisteredNode;
  minBalance: number;
  minChannels: number;
}) => {
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
      console.log("here");
      return true;
    }

    return false;
  } catch (e) {
    logError(["Error querying the graph", e]);
  }
};

export const validateNode = (
  graphRes: GetAccountChannelsResponse,
  minBalance: number,
  minChannels: number
) => {
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
