/**
 * Deprecated: to be replaced with the one in commons
 */
import { utils } from "rpch-commons";
import { utils as ethersUtils } from "ethers";
import WebSocket from "ws";
import fetch from "node-fetch";
const { createLogger, createApiUrl } = utils;
const { log, logError, logVerbose } = createLogger("hoprd");

/**
 * Request messaging access token from a selected HOPRd entry node
 */
export const requestMessagingAccessToken = () => {
  throw new Error("Not implemented yet");
};

/**
 * Send a segment to a HOPRd node.
 */
export const sendMessage = async ({
  apiEndpoint,
  apiToken,
  message,
  destination,
}: {
  apiEndpoint: string;
  apiToken: string | undefined;
  message: string;
  destination: string;
}): Promise<void | string> => {
  const [url, headers] = createApiUrl(
    "http",
    apiEndpoint,
    "/api/v2/messages",
    apiToken
  );

  const body: { body: string; recipient: string; path?: string[] } = {
    body: message,
    recipient: destination,
    path: [],
  };

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
    const text = await response.text();
    return text;
  }
};

/**
 * Subscribes to the HOPRd endpoint for incoming messages.
 * @param onMessage called everytime a new HOPRd message is received
 * @returns websocket listener
 */
export const createMessageListener = async (
  apiEndpoint: string,
  apiToken: string,
  onMessage: (message: string) => void
) => {
  const [url] = createApiUrl(
    "ws",
    apiEndpoint,
    "/api/v2/messages/websocket",
    apiToken
  );
  const ws = new WebSocket(url);

  ws.on("upgrade", () => {
    log("HORP RPC Relay is listening for messages coming from HOPRd at", url);
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

/**
 * Attemps to decode a HOPRd body.
 * @param body
 * @returns decoded message
 */
const decodeIncomingBody = (body: string): string | undefined => {
  try {
    return ethersUtils.toUtf8String(
      ethersUtils.RLP.decode(new Uint8Array(JSON.parse(`[${body}]`)))[0]
    );
  } catch {
    logVerbose("safely failed to decode body", body);
  }
};
