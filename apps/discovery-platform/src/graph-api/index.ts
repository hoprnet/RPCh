import { gql } from "graphql-request";
import fetch from "node-fetch";
import { QueryRegisteredNode } from "../registered-node/dto";
import { GraphHoprResponse } from "./dto";

const GRAPH_HOPR_URL =
  "https://api.thegraph.com/subgraphs/name/hoprnet/hopr-channels";

const query = gql`
  query getAccount($id: String!, $minBalance: BigDecimal!) {
    account(id: $id) {
      fromChannels(where: { status: OPEN }) {
        id
        balance
      }
    }
  }
`;

export const checkCommitment = async (ops: {
  node: QueryRegisteredNode;
  minBalance: number;
  minChannels: number;
}) => {
  // make query
  const channels = await fetch(GRAPH_HOPR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        id: ops.node.peerId,
        minBalance: ops.minBalance,
      },
    }),
  });
  const graphRes = (await channels.json()) as GraphHoprResponse;
  // check if it has enough balance and enough open channels
  if (validateNode(graphRes, ops.minBalance, ops.minChannels)) {
    return true;
  }

  return false;
};

export const validateNode = (
  graphRes: GraphHoprResponse,
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
