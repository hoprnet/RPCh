import { createLogger, createApiUrl, decodeIncomingBody } from "./utils";
import fetch from "cross-fetch";
import WebSocket from "isomorphic-ws";

const log = createLogger(["hoprd"]);

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
    path: [], // using direct path, TODO: change once auto path is fixed
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 202) {
    log.verbose("send message to HOPRd node", message, destination);
    const text = await response.text();
    return text;
  } else {
    log.error(
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

  ws.onopen = () => {
    log.normal("Listening for incoming messages from HOPRd", url);
  };

  ws.onmessage = (event) => {
    const body = event.data.toString();
    // message received is an acknowledgement of a
    // message we have send, we can safely ingore this
    if (body.startsWith("ack:")) return;

    log.verbose("received body from HOPRd", body);

    let message: string | undefined;
    try {
      message = decodeIncomingBody(body);
    } catch (error) {
      log.error(error);
    }
    if (!message) return;
    log.verbose("decoded received body", message);

    onMessage(message);
  };

  return () => {
    log.normal("Closing HOPRd listener");
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
    log.verbose("received addresses from HOPRd node");
    const result: { native: string; hopr: string } = await response.json();
    return result.hopr;
  } else {
    log.error(
      "failed to get addresses from HOPRd node",
      response.status,
      await response.text()
    );
  }
};
