import { WebSocket } from "isomorphic-ws";

export const NoMoreNodes = "no more nodes";

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

  return fetch(url, { method: "POST", headers, body }).then((res) => {
    if (res.status >= 500) {
      throw new Error(`Internal server error: ${JSON.stringify(res)}`);
    }
    if (res.status === 404) {
      throw new Error(NoMoreNodes);
    }
    return res.json();
  });
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

  return fetch(url, { headers }).then((res) => {
    if (res.status >= 500) {
      throw new Error(`Internal server error: ${JSON.stringify(res)}`);
    }
    if (res.status === 404) {
      throw new Error(NoMoreNodes);
    }
    return res.json();
  });
}

export function connectWS({
  apiEndpoint,
  accessToken,
}: {
  apiEndpoint: URL;
  accessToken: string;
}): WebSocket {
  const wsURL = new URL(apiEndpoint.toString());
  wsURL.protocol = apiEndpoint.protocol === "https:" ? "wss:" : "ws:";
  wsURL.pathname = "/api/v2/messages/websocket";
  wsURL.search = `?apiToken=${accessToken}`;
  return new WebSocket(wsURL);
}

export function send(
  {
    apiEndpoint,
    accessToken,
    recipient,
  }: { apiEndpoint: URL; accessToken: string; recipient: string },
  message: string
): Promise<string> {
  const url = new URL(apiEndpoint.toString());
  url.pathname = "/api/v2/messages";
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-auth-token": accessToken,
  };
  const body = JSON.stringify({
    body: message,
    path: [],
    recipient,
  });
  return fetch(url, { method: "POST", headers, body }).then((res) =>
    res.json()
  );
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

  return fetch(url, { headers }).then((resp) => {
    if (resp.status === 200) {
      return resp.json();
    }
    throw new Error(`wrong status ${resp}`);
  });
}
