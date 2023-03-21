import { createLogger, createApiUrl, decodeIncomingBody } from "./utils";
import fetch from "cross-fetch";
import WebSocket from "isomorphic-ws";
import { ForbiddenError, NotFoundError } from "./errors";

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
  const [url, headers] = createApiUrl({
    protocol: "http",
    apiEndpoint,
    path: "/api/v2/messages",
    apiToken,
  });

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

  if (response.status === 202) {
    log.verbose(
      "sent message to HOPRd node",
      message,
      destination,
      "with path",
      path && path.length > 0
        ? path.join("-")
        : path && path.length === 0
        ? "direct"
        : "auto-path"
    );
    const text = await response.text();
    return text;
  }
  if (response.status === 403) {
    let errorMessage = await response.text();
    log.error(
      "failed to authorize sending message to HOPRd node",
      response.status,
      errorMessage
    );
    throw new ForbiddenError(errorMessage);
  } else {
    let errorMessage = await response.text();
    log.error(
      "failed to send message to HOPRd node",
      response.status,
      errorMessage
    );
    throw new Error(errorMessage);
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
  const [url] = createApiUrl({
    protocol: "ws",
    apiEndpoint,
    path: "/api/v2/messages/websocket",
    apiToken,
  });
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
  const [url, headers] = createApiUrl({
    protocol: "http",
    apiEndpoint,
    path: "/api/v2/account/addresses",
    apiToken,
  });

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

export const createToken = async ({
  apiEndpoint,
  apiToken,
  tokenCapabilities,
  description,
  maxCalls,
}: {
  apiEndpoint: string;
  apiToken: string | undefined;
  tokenCapabilities: string[];
  description: string;
  maxCalls: number;
}) => {
  const [url, headers] = createApiUrl({
    protocol: "http",
    apiEndpoint,
    path: "/api/v2/tokens",
    apiToken,
  });

  const body: {
    capabilities: {
      endpoint: string;
      limits: { type: "calls"; conditions: { max: number } }[];
    }[];
    lifetime: number;
    description: string;
  } = {
    capabilities: tokenCapabilities.map((capability) => ({
      endpoint: capability,
      limits: [
        {
          type: "calls",
          conditions: {
            max: maxCalls,
          },
        },
      ],
    })),
    lifetime: 30 * 60e3, // 30 mins
    description,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 201) {
    log.verbose("received a new token");
    const result: { token: string } = await response.json();
    return result.token;
  } else {
    let errorMessage = await response.text();
    log.error(
      "failed to create token for HOPRd node",
      response.status,
      errorMessage
    );
    throw new Error(errorMessage);
  }
};

export const getToken = async ({
  apiEndpoint,
  apiToken,
}: {
  apiEndpoint: string;
  apiToken: string;
}) => {
  const [url, headers] = createApiUrl({
    protocol: "http",
    apiEndpoint,
    path: "/api/v2/token",
    apiToken,
  });

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (response.status === 200) {
    const result: {
      id: string;
      description: string;
      capabilities: {
        endpoint: string;
        limits: { type: string; conditions: { max: number } }[];
      }[];
    } = await response.json();
    return result;
  } else if (response.status === 403) {
    let errorMessage = await response.text();
    throw new ForbiddenError(errorMessage);
  } else if (response.status === 404) {
    let errorMessage = await response.text();
    throw new NotFoundError(errorMessage);
  } else {
    let errorMessage = await response.text();
    log.error(
      "failed to query token from HOPRd node",
      response.status,
      errorMessage
    );
    throw new Error(errorMessage);
  }
};

export const deleteToken = async ({
  apiEndpoint,
  apiToken,
  tokenToDelete,
}: {
  apiEndpoint: string;
  apiToken: string;
  tokenToDelete: string;
}): Promise<true> => {
  const [url, headers] = createApiUrl({
    protocol: "http",
    apiEndpoint,
    path: `/api/v2/token/${Buffer.from(tokenToDelete, "base64")}`,
    apiToken,
  });

  const response = await fetch(url, {
    method: "DELETE",
    headers,
  });

  if (response.status === 204) {
    return true;
  } else if (response.status === 403) {
    let errorMessage = await response.text();
    throw new ForbiddenError(errorMessage);
  } else if (response.status === 404) {
    let errorMessage = await response.text();
    throw new NotFoundError(errorMessage);
  } else {
    let errorMessage = await response.text();
    log.error(
      "failed to query token from HOPRd node",
      response.status,
      errorMessage
    );
    throw new Error(errorMessage);
  }
};
