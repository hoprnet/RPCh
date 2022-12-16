import { gql } from "graphql-request";
import fetch from "node-fetch";
import { QueryRegisteredNode } from "../registered-node/dto";
import { GraphHoprResponse } from "./dto";

const GRAPH_HOPR_URL =
  "https://api.thegraph.com/subgraphs/name/hoprnet/hopr-channels";

const query = gql`
  query getAccount($id: String!, $minBalance: BigDecimal!) {
    account(id: $id) {
      fromChannels(where: { status: OPEN, balance_gt: $minBalance }) {
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

const validateNode = (
  graphRes: GraphHoprResponse,
  minBalance: number,
  minChannels: number
) => {
  const validChannels = graphRes.data.account.fromChannels.filter(
    (channel) => channel.balance > minBalance
  );
  return validChannels.length > minChannels;
};
