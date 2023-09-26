import retry from "async-retry";
import { createLogger } from "./utils";

import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

export const NoMoreNodes = "no more nodes";

/**
 * This module contains all communication with the discovery platform.
 * All calls are behind exponential backoff to avoid DOSing the DP on errors.
 */

export type ClientOps = {
  discoveryPlatformEndpoint: string;
  clientId: string;
};

export type NodeOps = {
  discoveryPlatformEndpoint: string;
  nodeAccessToken: string;
};

export type Nodes = {
  entryNodes: EntryNode[];
  exitNodes: ExitNode[];
  matchedAt: string;
};

export type QuotaParams = {
  clientId: string;
  rpcMethod?: string;
  segmentCount: number;
  lastSegmentLength?: number;
  type: "request" | "response";
};

const DefaultBackoff = {
  retries: 5,
  factor: 3,
  minTimeout: 1e3,
  maxTimeout: 60e3,
  randomize: true,
};

const log = createLogger(["sdk", "dp-api"]);

export function fetchNodes(
  ops: ClientOps,
  amount: number,
  since: Date
): Promise<Nodes> {
  const url = new URL(
    "/api/v1/nodes/zero_hop_pairings",
    ops.discoveryPlatformEndpoint
  );
  url.searchParams.set("amount", `${amount}`);
  url.searchParams.set("since", since.toISOString());
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-rpch-client": ops.clientId,
  };

  return retry(async (bail, num) => {
    if (num > 1) {
      log.verbose(
        "Retrying",
        url.host.toString(),
        "after",
        num - 1,
        "failure(s)"
      );
    }
    const res = await fetch(url, { headers });
    if (res.status !== 200) {
      log.info("Fetching nodes returned", res.status);
    }
    switch (res.status) {
      case 204: // none found
        return bail(new Error(NoMoreNodes));
      case 400: // validation errors
      case 403: // unauthorized
        return bail(new Error((await res.json()) as unknown as string));
    }
    return res.json() as unknown as Nodes;
  }, DefaultBackoff) as Promise<Nodes>;
}

export function fetchQuota(
  ops: NodeOps,
  { clientId, segmentCount, rpcMethod, type, lastSegmentLength }: QuotaParams
): Promise<void> {
  const url = new URL(`/api/v1/quota/${type}`, ops.discoveryPlatformEndpoint);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-rpch-node": ops.nodeAccessToken,
  };
  const body = JSON.stringify({
    clientId,
    segmentCount,
    rpcMethod,
    lastSegmentLength,
  });
  return new Promise((pRes, pRej) => {
    fetch(url, { headers, method: "POST", body })
      .then((res) => {
        if (res.status === 204) {
          return pRes();
        }
        return pRej(`Unexpected response code: ${res.status}`);
      })
      .catch((err) => pRej(err));
  });
}
