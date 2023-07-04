import fetch from "cross-fetch";
import { WebSocketHelper, type onEventType } from "@rpch/common";

import { createLogger } from "./utils";

const log = createLogger(["nodes-collector"]);

const apiEntryNode = "/api/v1/request/entry-node";
const apiWebSocket = "/api/v2/messages/websocket";

/**
nodes come in pairs

entry node, exit node

websocket ping with timestamp
sent message with timestamp
received message with timestamp

working node pairs with timestamps
*/

type EntryNode = {
  apiEndpoint: URL;
  apiToken: string;
  peerId: string;
  connection: any;
};
type ResponseEntryNode = {
  hoprd_api_endpoint: string;
  accessToken: string;
  id: string;
};

type ExitNode = {
  peerId: string;
  pubKey: string;
};

type Reliability = {
  onlineHistory: { date: number; online: boolean }[];
};

export type NodesCollectorOps = {};

const defaultOps: NodesCollectorOps = {};

export default class NodesCollector {
  private readonly ops: NodesCollectorOps;
  private readonly entryNodes = new Map<string, EntryNode>();
  private readonly exitNodes = new Map<string, ExitNode>();
  private readonly reliabilities = new Map<string, Reliability>();

  constructor(
    private readonly discoveryPlatformEndpoint: string,
    private readonly apiClient: string,
    private readonly onWSmessage: (peerId: string, message: string) => void,
    ops: NodesCollectorOps = defaultOps
  ) {
    this.ops = {
      ...defaultOps,
      ...ops,
    };
  }

  private fetchEntryNodes() {
    const excludeList = Array.from(this.entryNodes.keys());
    const url = new URL(apiEntryNode, this.discoveryPlatformEndpoint);
    const headers = {
      "Content-Type": "application/json",
      "Accept-Content": "application/json",
      "x-rpch-client": this.apiClient,
    };
    const body = JSON.stringify({
      excludeList,
      client: this.apiClient,
    });

    fetch(url, { method: "POST", headers, body })
      .then((resp) => {
        if (resp.status === 200) {
          return resp.json();
        }
        throw new Error(`wrong status ${resp}`);
      })
      .catch((err) => log.error("Error requesting entry node:", err));
  }

  private responseEntryNode({
    hoprd_api_endpoint,
    accessToken,
    id,
  }: ResponseEntryNode) {
    const apiEndpoint = new URL(hoprd_api_endpoint);
    const wsURL = new URL(hoprd_api_endpoint);
    wsURL.protocol = apiEndpoint.protocol === "https:" ? "wss:" : "ws:";
    wsURL.pathname = apiWebSocket;
    const onEvent = this.onWSevent(id);
    // create websocket connection
    const connection = new WebSocketHelper(wsURL, onEvent);
    const newNode: EntryNode = {
      apiEndpoint,
      apiToken: accessToken,
      connection,
      peerId: id,
    };
    this.entryNodes.set(id, newNode);
    this.reliabilities.set(id, emptyReliability());
  }

  private onWSevent(peerId: string): onEventType {
    return (evt) => {
      switch (evt.action) {
        case "open":
        case "ping":
          this.updateOnlineHistory(peerId, true);
          break;

        case "message":
          this.updateOnlineHistory(peerId, true);
          this.onWSmessage(peerId, evt.message);
          break;

        case "close":
        case "error":
          this.updateOnlineHistory(peerId, false);
          break;
      }
    };
  }

  private updateOnlineHistory(peerId: string, online: boolean) {
    const cur = this.reliabilities.get(peerId);
    const entry = { date: Date.now(), online };
    cur!.onlineHistory.push(entry);
    this.reliabilities.set(peerId, cur!);
  }
}

function emptyReliability(): Reliability {
  return {
    onlineHistory: [],
  };
}
