import { WebSocket } from "isomorphic-ws";
import retry from "async-retry";

export function fetchEntryNode({
  excludeList,
  discoveryPlatformEndpoint,
  clientId,
}: {
  excludeList: string[];
  discoveryPlatformEndpoint: string;
  clientId: string;
}): Promise<{
  hoprd_api_endpoint: string;
  accessToken: string;
  id: string;
}> {
  const url = new URL("/api/v1/request/entry-node", discoveryPlatformEndpoint);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-rpch-client": clientId,
  };
  const body = JSON.stringify({
    excludeList,
    client: clientId,
  });

  return retry(
    async function (bail) {
      const res = await fetch(url, { method: "POST", headers, body });
      if (res.status >= 500) {
        bail(new Error(`Internal server error: ${JSON.stringify(res)}`));
      }
      if (res.status === 404) {
        bail(new Error("no more nodes"));
      }
      return await res.json();
    },
    {
      retries: 3,
      factor: 3,
      minTimeout: 3e3,
      maxTimeout: 120e3,
      randomize: true,
    }
  );
}

export function fetchExitNodes({
  discoveryPlatformEndpoint,
  clientId,
}: {
  discoveryPlatformEndpoint: string;
  clientId: string;
}): Promise<
  {
    exit_node_pub_key: string;
    id: string;
  }[]
> {
  const url = new URL(
    "/api/v1/node?hasExitNode=true",
    discoveryPlatformEndpoint
  );
  const headers = {
    Accept: "application/json",
    "x-rpch-client": clientId,
  };

  return retry(
    async function (bail) {
      const res = await fetch(url, { headers });
      if (res.status >= 500) {
        bail(new Error(`Internal server error: ${JSON.stringify(res)}`));
      }
      if (res.status === 404) {
        bail(new Error("no more nodes"));
      }
      return await res.json();
    },
    {
      retries: 3,
      factor: 3,
      minTimeout: 3e3,
      maxTimeout: 120e3,
      randomize: true,
    }
  );
}

export function connectWS({
  apiEndpoint,
  accessToken,
}: {
  apiEndpoint: URL;
  accessToken: string;
}): WebSocket {
  const wsURL = new URL(apiEndpoint.toString());
  wsURL.protocol = apiEndpoint.protocol === "https:" ? "wss:" : "ws:";
  wsURL.pathname = "/api/v2/messages/websocket";
  wsURL.search = `?apiToken=${accessToken}`;
  return new WebSocket(wsURL);
}

/*
function fetchNode(
  {
    discoveryPlatformEndpoint,
    clientId,
  }: { discoveryPlatformEndpoint: string; clientId: string },
  peerId: string
) {
  const url = new URL(`/api/v1/node/${peerId}`, discoveryPlatformEndpoint);
  const headers = {
    Accept: "application/json",
    "x-rpch-client": clientId,
  };

  return fetch(url, { headers })
    .then((resp) => {
      if (resp.status === 200) {
        return resp.json();
      }
      throw new Error(`wrong status ${resp}`);
    })
    .then((json) => {
      console.log("NODE", json);
    });
}
*/
