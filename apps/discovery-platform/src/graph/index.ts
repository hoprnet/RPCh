import fetch from "node-fetch";
import { gql } from "graphql-request";
import { QueryRegisteredNode } from "../registered-node/dto";
import { GraphHoprResponse } from "./dto";
import { updateRegisteredNode } from "../registered-node";
import { DBInstance } from "../db";

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
  db: DBInstance;
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
    // update node to status "READY"
    await updateRegisteredNode(ops.db, { ...ops.node, status: "READY" });
    // fund here?
  }
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
