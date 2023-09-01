import { WebSocket } from "isomorphic-ws";

export function connectWS({
  apiEndpoint,
  accessToken,
}: {
  apiEndpoint: URL;
  accessToken: string;
}): WebSocket {
  const wsURL = new URL(apiEndpoint.toString());
  wsURL.protocol = apiEndpoint.protocol === "https:" ? "wss:" : "ws:";
  wsURL.pathname = "/api/v3/messages/websocket";
  wsURL.search = `?apiToken=${accessToken}`;
  return new WebSocket(wsURL);
}

export function sendMessage(
  {
    apiEndpoint,
    accessToken,
    recipient,
    tag,
  }: {
    apiEndpoint: URL;
    accessToken: string;
    recipient: string;
    tag: number;
  },
  message: string
): Promise<string> {
  const url = new URL(apiEndpoint.toString());
  url.pathname = "/api/v3/messages";
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-auth-token": accessToken,
  };
  const body = JSON.stringify({
    body: message,
    path: [],
    peerId: recipient,
    tag,
  });
  return fetch(url, { method: "POST", headers, body }).then((res) =>
    res.json()
  );
}
