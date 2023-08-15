import retry from "async-retry";
export const NoMoreNodes = "no more nodes";

/**
 * This module contains all communication with the discovery platform.
 * All calls are behind exponential backoff to avoid DOSing the DP on errors.
 */

export type RawEntryNode = {
  hoprd_api_endpoint: string;
  accessToken: string;
  id: string;
};

export type RawExitNode = {
  exit_node_pub_key: string;
  id: string;
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

const DefaultBackoff = {
  retries: 5,
  factor: 3,
  minTimeout: 1e3,
  maxTimeout: 60e3,
  randomize: true,
};

export function fetchEntryNode({
  excludeList,
  discoveryPlatformEndpoint,
  clientId,
}: {
  excludeList: string[];
  discoveryPlatformEndpoint: string;
  clientId: string;
}): Promise<RawEntryNode> {
  const url = new URL("/api/v1/request/entry-node", discoveryPlatformEndpoint);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-rpch-client": clientId,
  };
  const body = JSON.stringify({
    excludeList,
    client: clientId,
  });

  return retry(async (bail) => {
    const res = await fetch(url, { method: "POST", headers, body });
    if (res.status === 404) {
      return bail(new Error(NoMoreNodes));
    }
    return res.json();
  }, DefaultBackoff);
}

export function fetchExitNodes({
  discoveryPlatformEndpoint,
  clientId,
}: {
  discoveryPlatformEndpoint: string;
  clientId: string;
}): Promise<RawExitNode[]> {
  const url = new URL(
    "/api/v1/node?hasExitNode=true",
    discoveryPlatformEndpoint
  );
  const headers = {
    Accept: "application/json",
    "x-rpch-client": clientId,
  };

  return retry(async (bail) => {
    const res = await fetch(url, { headers });
    if (res.status === 404) {
      return bail(new Error(NoMoreNodes));
    }
    return res.json();
  }, DefaultBackoff);
}

export function fetchNode(
  {
    discoveryPlatformEndpoint,
    clientId,
  }: { discoveryPlatformEndpoint: string; clientId: string },
  peerId: string
): Promise<RawNode> {
  const url = new URL(`/api/v1/node/${peerId}`, discoveryPlatformEndpoint);
  const headers = {
    Accept: "application/json",
    "x-rpch-client": clientId,
  };

  return retry(async (_bail) => {
    const res = await fetch(url, { headers });
    return res.json();
  }, DefaultBackoff);
}
