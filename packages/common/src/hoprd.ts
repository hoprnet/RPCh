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
  path,
  hops,
}: {
  apiEndpoint: string;
  apiToken: string | undefined;
  message: string;
  destination: string;
  path?: string[];
  hops?: number;
}): Promise<void | string> => {
  const [url, headers] = createApiUrl(
    "http",
    apiEndpoint,
    "/api/v2/messages",
    apiToken
  );

  const body: {
    body: string;
    recipient: string;
    path?: string[];
    hops?: number;
  } = {
    body: message,
    recipient: destination,
    path,
    hops,
  };

  log.verbose(
    "sending message to HOPRd node",
    message,
    destination,
    "with path",
    path && path.length > 0
      ? path.join("-")
      : path && path.length === 0
      ? "direct"
      : "auto-path"
  );

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const genericLogInfo = [
    message,
    destination,
    "with path",
    path && path.length > 0
      ? path.join("-")
      : path && path.length === 0
      ? "direct"
      : "auto-path",
  ].join(" ");
  if (response.status === 202) {
    log.verbose("sent message to HOPRd node", genericLogInfo);
    const text = await response.text();
    return text;
  } else {
    let errorMessage = await response.text();
    log.error(
      "failed to send message to HOPRd node",
      genericLogInfo,
      response.status,
      errorMessage
    );
    throw new Error(
      `HOPRd node responsed with error "${errorMessage}" when sending message: ${genericLogInfo}`
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
  const ws = await new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url);

    socket.onopen = () => {
      log.normal("Listening for incoming messages from HOPRd", url);
      resolve(socket);
    };

    socket.onerror = (event) => {
      log.error("WebSocket error:", event);
      reject(event.error);
    };
  });

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

  ws.onerror = (event) => {
    log.error("WebSocket error:", event);
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
