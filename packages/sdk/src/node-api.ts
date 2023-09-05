import { WebSocket } from "isomorphic-ws";

/**
 * to be replaced with HOPR sdk soon.
 */

export type ConnInfo = { apiEndpoint: URL; accessToken: string };

export type Message = { tag: number; body: string };

export function connectWS(conn: ConnInfo): WebSocket {
  const wsURL = new URL("/api/v3/messages/websocket", conn.apiEndpoint);
  wsURL.protocol = conn.apiEndpoint.protocol === "https:" ? "wss:" : "ws:";
  wsURL.search = `?apiToken=${conn.accessToken}`;
  return new WebSocket(wsURL);
}

export function sendMessage(
  conn: ConnInfo,
  {
    recipient,
    tag,
    message,
  }: { recipient: string; tag: number; message: string }
): Promise<string> {
  const url = new URL("/api/v3/messages", conn.apiEndpoint);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-auth-token": conn.accessToken,
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

export function version(conn: ConnInfo) {
  const url = new URL("/api/v3/node/version", conn.apiEndpoint);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-auth-token": conn.accessToken,
  };
  return fetch(url, { headers }).then((res) => res.json());
}

export function retrieveMessages(
  conn: ConnInfo,
  tag: number
): Promise<{ messages: Message[] }> {
  const url = new URL("/api/v3/messages/pop-all", conn.apiEndpoint);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-auth-token": conn.accessToken,
  };
  const body = JSON.stringify({ tag });
  return fetch(url, { method: "POST", headers, body }).then((res) => {
    return res.json();
  });
}
