import { createLogger, createApiUrl, decodeIncomingBody } from "./utils";
import WebSocket from "ws";
import fetch from "node-fetch";

const { log, logError, logVerbose } = createLogger(["common", "hoprd"]);

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

  if (response.status === 202) {
    logVerbose("send message to HOPRd node", message, destination);
    const text = await response.text();
    return text;
  } else {
    logError(
      "failed to send message to HOPRd node",
      response.status,
      await response.text()
    );
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
    log("Listening for incoming messages from HOPRd", url);
  });

  ws.on("message", (data: { toString: () => string }) => {
    const body = data.toString();
    logVerbose("received body from HOPRd");

    let message: string | undefined;
    try {
      message = decodeIncomingBody(body);
    } catch (error) {
      logError(error);
    }
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
 * Send a segment to a HOPRd node.
 */
export const fetchPeerId = async ({
  apiEndpoint,
  apiToken,
}: {
  apiEndpoint: string;
  apiToken: string | undefined;
}): Promise<void | string> => {
  const [url, headers] = createApiUrl(
    "http",
    apiEndpoint,
    "/api/v2/account/addresses",
    apiToken
  );

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (response.status === 200) {
    logVerbose("received addresses from HOPRd node");
    const result: { native: string; hopr: string } = await response.json();
    return result.hopr;
  } else {
    logError(
      "failed to get addresses from HOPRd node",
      response.status,
      await response.text()
    );
  }
};
