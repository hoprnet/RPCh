export type Heartbeats = {
  sent: number;
  success: number;
};

export type Peer = {
  peerId: string;
  multiAddr: string;
  heartbeats: Heartbeats[];
  lastSeen: number;
  quality: number;
  backoff: number;
  isNew: boolean;
  reportedVersion: string;
};

export type Peers = {
  connected: Peer[];
  announced: Peer[];
};

export type Channel = {
  channelId: string;
  sourceAddress: string;
  destinationAddress: string;
  sourcePeerId: string;
  destinationPeerId: string;
  balance: string;
  status: string;
  ticketIndex: string;
  channelEpoch: string;
  closureTime: string;
};

export type Channels = {
  all: Channel[];
  incoming: [];
  outgoing: [];
};

export function getPeers({
  hoprd_api_endpoint,
  hoprd_api_token,
}: {
  hoprd_api_endpoint: string;
  hoprd_api_token: string;
}): Promise<Peers> {
  const url = new URL("/api/v3/node/peers", hoprd_api_endpoint);
  url.searchParams.set("quality", "1");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-auth-token": hoprd_api_token,
  };
  return fetch(url, { headers }).then((res) => res.json());
}

export function getChannels({
  hoprd_api_endpoint,
  hoprd_api_token,
}: {
  hoprd_api_endpoint: string;
  hoprd_api_token: string;
}): Promise<any> {
  const url = new URL("/api/v3/channels", hoprd_api_endpoint);
  url.searchParams.set("fullTopology", "true");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-auth-token": hoprd_api_token,
  };
  return fetch(url, { headers }).then((res) => res.json());
}
