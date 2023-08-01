import { WebSocketHelper, type onEventType } from "@rpch/common";
import { type EntryNode, type ExitNode } from "./nodes";

const apiEntryNode = "/api/v1/request/entry-node";
const apiWebSocket = "/api/v2/messages/websocket";
const apiExitNode = "/api/v1/node?hasExitNode=true";

export function fetchEntryNode({
  excludeList,
  discoveryPlatformEndpoint,
  clientId,
}: {
  excludeList: string[];
  discoveryPlatformEndpoint: string;
  clientId: string;
}): Promise<EntryNode> {
  const url = new URL(apiEntryNode, discoveryPlatformEndpoint);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-rpch-client": clientId,
  };
  const body = JSON.stringify({
    excludeList,
    client: clientId,
  });

  return fetch(url, { method: "POST", headers, body })
    .then((resp) => {
      if (resp.status === 200) {
        return resp.json() as unknown as {
          hoprd_api_endpoint: string;
          accessToken: string;
          id: string;
        };
      }
      throw new Error(`wrong status ${resp.status} ${resp.statusText}`);
    })
    .then((json) => {
      return {
        apiEndpoint: new URL(json.hoprd_api_endpoint),
        accessToken: json.accessToken,
        peerId: json.id,
        recommendedExits: new Set(),
      };
    });
}

export function fetchExitNodes({
  discoveryPlatformEndpoint,
  clientId,
}: {
  discoveryPlatformEndpoint: string;
  clientId: string;
}): Promise<ExitNode[]> {
  const url = new URL(apiExitNode, discoveryPlatformEndpoint);
  const headers = {
    Accept: "application/json",
    "x-rpch-client": clientId,
  };

  return fetch(url, { headers })
    .then((resp) => {
      if (resp.status === 200) {
        return resp.json() as unknown as {
          exit_node_pub_key: string;
          id: string;
        }[];
      }
      throw new Error(`wrong status ${resp}`);
    })
    .then((json) => {
      return json.map(({ exit_node_pub_key, id }) => ({
        pubKey: exit_node_pub_key,
        peerId: id,
      }));
    });
}

export function openWebSocket(
  { apiEndpoint, accessToken }: EntryNode,
  onEvent: onEventType
) {
  const wsURL = new URL(apiEndpoint.toString());
  wsURL.protocol = apiEndpoint.protocol === "https:" ? "wss:" : "ws:";
  wsURL.pathname = apiWebSocket;
  wsURL.search = `?apiToken=${accessToken}`;
  return new WebSocketHelper(wsURL, onEvent, {
    maxReconnectAttempts: 0,
  });
}
