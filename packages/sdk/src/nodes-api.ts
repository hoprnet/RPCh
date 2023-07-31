import { WebSocketHelper, type onEventType } from "@rpch/common";
import { type EntryNode, type ExitNode, WSstate } from "./nodes";

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

  return fetch(url, { method: "POST", headers, body }).then((resp) => {
    if (resp.status === 200) {
      const res = resp.json() as unknown as {
        hoprd_api_endpoint: string;
        accessToken: string;
        id: string;
      };
      return {
        apiEndpoint: new URL(res.hoprd_api_endpoint),
        accessToken: res.accessToken,
        latencyViolations: 0,
        ongoingRequests: 0,
        peerId: res.id,
        recommendedExits: new Set(),
        wsState: WSstate.Disconnected,
      };
    }
    throw new Error(`wrong status ${resp.status} ${resp.statusText}`);
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

  return fetch(url, { headers }).then((resp) => {
    if (resp.status === 200) {
      const res = resp.json() as unknown as {
        exit_node_pub_key: string;
        id: string;
      }[];
      return res.map(({ exit_node_pub_key, id }) => ({
        ongoingRequests: 0,
        pubKey: exit_node_pub_key,
        peerId: id,
      }));
    }
    throw new Error(`wrong status ${resp}`);
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
  return new WebSocketHelper(wsURL, onEvent);
}
