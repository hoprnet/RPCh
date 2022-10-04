/**
 * Responsible for listening for incoming HOPRd messages and creating new ones.
 */

import WebSocket from "ws";
import fetch from "node-fetch";
import { utils } from "ethers";
import { createLogger, createApiUrl } from "./utils";

const { log, logError, logVerbose } = createLogger("hoprd");

/**
 * Attemps to decode a HOPRd body.
 * @param body
 * @returns decoded message
 */
const decodeIncomingBody = (body: string): string | undefined => {
  try {
    return utils.toUtf8String(
      utils.RLP.decode(new Uint8Array(JSON.parse(`[${body}]`)))[0]
    );
  } catch {
    logVerbose("safely failed to decode body", body);
  }
};

/**
 * @returns HOPRd's peerID
 */
export const fetchPeerId = async (
  apiEndpoint: string,
  apiToken?: string
): Promise<string> => {
  const [url, headers] = createApiUrl(
    "http",
    apiEndpoint,
    "/api/v2/account/addresses",
    apiToken
  );

  return fetch(url, { headers })
    .then((res) => res.json())
    .then((res) => res.hopr);
};

/**
 * Fetch peers which can be used as exit nodes.
 * @warn Assumes all peers run a RPCh node.
 * @param apiEndpoint
 * @param apiToken
 * @returns
 */
export const fetchPeers = async (
  apiEndpoint: string,
  apiToken?: string
): Promise<string[]> => {
  const [url, headers] = createApiUrl(
    "http",
    apiEndpoint,
    "/api/v2/node/peers",
    apiToken
  );

  return fetch(url, { headers })
    .then((res) => res.json())
    .then((res) => res.connected.map((o: any) => o.peerId));
};

/**
 * Send a segment to a HOPRd node.
 */
export const sendMessage = async (
  apiEndpoint: string,
  apiToken: string | undefined,
  message: string,
  destination: string
): Promise<void> => {
  const [url, headers] = createApiUrl(
    "http",
    apiEndpoint,
    "/api/v2/messages",
    apiToken
  );

  const body: { body: string, recipient: string, path?: string[] } = {
      body: message,
      recipient: destination,
      path: []
  }

  if (process.env.USE_AUTO_PATHFINDING == 'true') {
    delete(body.path)
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (response.status !== 202) {
    logError(
      "failed to send message to HOPRd node",
      response.status,
      await response.text()
    );
  } else {
    log("send message to HOPRd node", message, destination);
  }
};

/**
 * Subscribes to the HOPRd endpoint for incoming messages.
 * @param onMessage called everytime a new HOPRd message is received
 * @returns websocket listener
 */
export const createListener = (
  apiEndpoint: string,
  apiToken: string | undefined,
  onMessage: (message: string) => void
): (() => void) => {
  const [url] = createApiUrl(
    "ws",
    apiEndpoint,
    "/api/v2/messages/websocket",
    apiToken
  );
  const ws = new WebSocket(url);

  ws.on("upgrade", () => {
    console.log(
      "HORP RPC Relay is listening for messages coming from HOPRd at",
      url
    );
  });

  ws.on("message", (data: { toString: () => string }) => {
    const body = data.toString();
    log("received body from HOPRd");

    const message = decodeIncomingBody(body);
    if (!message) return;
    logVerbose("decoded received body", message);

    onMessage(message);
  });

  return () => {
    log("Closing HOPRd listener");
    ws.close();
  };
};
