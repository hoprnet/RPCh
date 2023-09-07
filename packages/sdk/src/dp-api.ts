import retry from "async-retry";
export const NoMoreNodes = "no more nodes";

import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

/**
 * This module contains all communication with the discovery platform.
 * All calls are behind exponential backoff to avoid DOSing the DP on errors.
 */

export type Ops = {
  discoveryPlatformEndpoint: string;
  clientId: string;
};

export type RawNode = {
  node: {
    id: string;
    has_exit_node: boolean;
    chain_id: number;
    hoprd_api_endpoint: string;
    hoprd_api_token: string;
    exit_node_pub_key: string;
    native_address: string;
    total_amount_funded: string;
    honesty_score: string;
    reason?: string;
    status: string;
    created_at: Date;
    updated_at: Date;
  };
};

export type Nodes = {
  entryNodes: EntryNode[];
  exitNodes: ExitNode[];
  matchedAt: string;
};

const DefaultBackoff = {
  retries: 5,
  factor: 3,
  minTimeout: 1e3,
  maxTimeout: 60e3,
  randomize: true,
};

export function fetchNode(ops: Ops, peerId: string): Promise<RawNode> {
  const url = new URL(`/api/v1/node/${peerId}`, ops.discoveryPlatformEndpoint);
  const headers = {
    Accept: "application/json",
    "x-rpch-client": ops.clientId,
  };

  return retry(async (_bail) => {
    const res = await fetch(url, { headers });
    return res.json();
  }, DefaultBackoff);
}

export function fetchNodes(
  ops: Ops,
  amount: number,
  since: Date
): Promise<Nodes> {
  const url = new URL(
    "/api/v1/nodes/zero_hop_pairings",
    ops.discoveryPlatformEndpoint
  );
  url.searchParams.set("amount", `${amount}`);
  url.searchParams.set("since", since.toISOString());
  const headers = { Accept: "application/json", "x-rpch-client": ops.clientId };

  return retry(async (bail) => {
    const res = await fetch(url, { headers });
    switch (res.status) {
      case 204: // none found
        return bail(new Error(NoMoreNodes));
      case 400: // validation errors
      case 403: // unauthorized
        return bail(new Error(await res.json()));
    }
    return res.json();
  }, DefaultBackoff);
}
