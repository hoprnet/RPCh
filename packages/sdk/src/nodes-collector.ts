import fetch from "cross-fetch";
import { WebSocketHelper, type onEventType } from "@rpch/common";
import * as Reliability from "./reliability";
import { createLogger } from "./utils";

const log = createLogger(["nodes-collector"]);

const apiEntryNode = "/api/v1/request/entry-node";
const apiWebSocket = "/api/v2/messages/websocket";
const apiExitNode = "/api/v1/node?hasExitNode=true";

const timeoutImmediateFetchEntryNode = 100;
const timeoutOptimizeFetchEntryNode = 3e3;
const timeoutRegularFetchEntryNode = 30e3;

const timeoutRegularFetchExitNodes = 60e3 * 5; // 5 min

const intervalExpireReliabilities = 60e3 * 5; // 5 min

/**
nodes come in pairs

entry node, exit node

sent message with timestamp
received message with timestamp

working node pairs with timestamps
*/

export type EntryNode = {
  apiEndpoint: URL;
  apiToken: string;
  peerId: string;
  connection: any;
  recommendedExitNodes: ExitNode[];
};

export type ExitNode = {
  peerId: string;
  pubKey: string;
};

type ResponseEntryNode = {
  hoprd_api_endpoint: string;
  accessToken: string;
  id: string;
};

type ResponseExitNode = {
  exit_node_pub_key: string;
  id: string;
};

export type NodesCollectorOps = {
  entryNodesTarget: number;
  maxReliabilityAge: number;
};

const defaultOps: NodesCollectorOps = {
  entryNodesTarget: 10,
  maxReliabilityAge: 60e3 * 5, // 5 min
};

export default class NodesCollector {
  private readonly ops: NodesCollectorOps;
  private readonly entryNodes = new Map<string, EntryNode>();
  // will be removed once exit nodes are recommended for entry nodes
  private readonly genericExitNodes = new Map<string, ExitNode>();
  private readonly reliabilities = new Map<string, Reliability.Reliability>();
  private timerRefEntryNodes: ReturnType<typeof setTimeout>;
  private timerRefExitNodes: ReturnType<typeof setTimeout>;
  private timerRefExpiration: ReturnType<typeof setTimeout>;

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

    // start fetching entry / exit nodes
    this.timerRefEntryNodes = setTimeout(() => this.fetchEntryNodes());
    this.timerRefExitNodes = setTimeout(() => this.fetchExitNodes());
    this.timerRefExpiration = setInterval(
      () => this.expireReliabilities(),
      intervalExpireReliabilities
    );
  }

  /**
   * This is the main entry for finding reliable node pair based on recent node behaviours.
   * Will need testing and adjustments to increase reliability.
   *
   */
  public findReliableNodePair = async (
    timeout: number
  ): Promise<{ entryNode: EntryNode; exitNode: ExitNode }> => {
    return new Promise((resolve, reject) => {

    });
  };

  public hasReliableNodePair = () => {
    const reliables = this.filterReliableIds();
    return reliables.length > 0 && this.genericExitNodes.size > 0;
  };

  public recordOngoing = (entryPeerId: string, exitPeerId: string) => {
    const cur = this.reliabilities.get(entryPeerId);
    if (cur) {
      // record only tracked nodes
      const next = Reliability.setExitNodeOngoing(cur, exitPeerId);
      this.reliabilities.set(entryPeerId, next);
    }

  }
  public recordSuccess = (entryPeerId: string, exitPeerId: string) => {
    const cur = this.reliabilities.get(entryPeerId);
    if (cur) {
      // record only tracked nodes
      const res = Reliability.updateExitNodeSuccess(cur, exitPeerId, true);
      switch (res.res) {
          case "ok":
      this.reliabilities.set(entryPeerId, res.rel)
          break;
          case "error":
              log.error("Error recording success", res.reason, entryPeerId, exitPeerId);
          break;
      }
      }
  };

  public recordFailure = (entryPeerId: string, exitPeerId: string) => {
    const cur = this.reliabilities.get(entryPeerId);
    if (cur) {
      // record only tracked nodes
      const res = Reliability.updateExitNodeSuccess(cur, exitPeerId, false);
      switch (res.res) {
          case "ok":
      this.reliabilities.set(entryPeerId, res.rel);
      break;
      case "error":
              log.error("Error recording failure", res.reason, entryPeerId, exitPeerId);
      break;
      }
    }
  };

  private fetchEntryNodes = () => {
    const excludeList = Array.from(this.entryNodes.keys());
    const url = new URL(apiEntryNode, this.discoveryPlatformEndpoint);
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
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
      .then(this.responseEntryNode)
      .catch((err) => log.error("Error requesting entry node:", err));
  };

  private fetchExitNodes = () => {
    const url = new URL(apiExitNode, this.discoveryPlatformEndpoint);
    const headers = {
      Accept: "application/json",
      "x-rpch-client": this.apiClient,
    };
    fetch(url, { headers })
      .then((resp) => {
        if (resp.status === 200) {
          return resp.json();
        }
        throw new Error(`wrong status ${resp}`);
      })
      .then(this.responseExitNode)
      .catch((err) => log.error("Error requesting exit node:", err));
  };

  private responseEntryNode = ({
    hoprd_api_endpoint,
    accessToken,
    id,
  }: ResponseEntryNode) => {
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
      recommendedExitNodes: [],
    };
    log.info("Response entry node", newNode);
    this.entryNodes.set(id, newNode);
    this.reliabilities.set(id, Reliability.empty());
    this.scheduleEntryNodeFetching();
  };

  private responseExitNode = (resp: ResponseExitNode[]) => {
    const exitNodes = resp.map(({ exit_node_pub_key, id }) => ({
      peerId: id,
      pubKey: exit_node_pub_key,
    }));
    log.info("Response exit nodes", exitNodes);
    exitNodes.forEach((node) => this.genericExitNodes.set(node.peerId, node));
    this.scheduleExitNodeFetching();
  };

  private scheduleEntryNodeFetching = () => {
    clearTimeout(this.timerRefEntryNodes);
    // immediately fetch new nodes if too few - should be refactored into getting more nodes in one call
    if (this.entryNodes.size < this.ops.entryNodesTarget) {
      this.timerRefEntryNodes = setTimeout(
        () => this.fetchEntryNodes(),
        timeoutImmediateFetchEntryNode
      );
      return;
    }

    // check reliable nodes
    const reliables = this.filterReliableIds();
    if (reliables.length < this.ops.entryNodesTarget) {
      // fetch new nodes faster if reliable nodes are missing
      this.timerRefEntryNodes = setTimeout(
        () => this.fetchEntryNodes(),
        timeoutOptimizeFetchEntryNode
      );
    } else {
      // fetch regularly to avoid node starvation
      this.timerRefEntryNodes = setTimeout(
        () => this.fetchEntryNodes(),
        timeoutRegularFetchEntryNode
      );
    }
  };

  private scheduleExitNodeFetching = () => {
    clearTimeout(this.timerRefExitNodes);
    // fetch regularly to avoid node starvation
    this.timerRefExitNodes = setTimeout(
      () => this.fetchExitNodes(),
      timeoutRegularFetchExitNodes
    );
  };

  private onWSevent = (peerId: string): onEventType => {
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
  };

  private updateOnlineHistory = (peerId: string, online: boolean) => {
    const cur = this.reliabilities.get(peerId);
    if (cur) {
      // update only tracked nodes
      const next = Reliability.updateOnline(cur, online);
      this.reliabilities.set(peerId, next);
    }
  };

  private filterReliableIds = () => {
    return Array.from(this.entryNodes.keys()).filter((pId) => {
      const rel = this.reliabilities.get(pId);
      return Reliability.isReliable(rel!);
    });
  };

  private expireReliabilities = () => {
    for (const id of this.reliabilities.keys()) {
      const rel = this.reliabilities.get(id)!;
      const next = Reliability.expireOlderThan(rel, this.ops.maxReliabilityAge);
      if (Reliability.isEmpty(next)) {
        // remove node
        this.reliabilities.delete(id);
        this.entryNodes.delete(id);
      }
    }
  };

  private doFindReliableNodePair = (): { entryNode: EntryNode; exitNode: ExitNode } | string => {
    const entryNodeIds = Array.from(this.entryNodes.keys());
    // 1. take online nodes
    const onlineIds = entryNodeIds.filter((id) => {
      const rel = this.reliabilities.get(id)!;
      return Reliability.isOnline(rel);
    });

    if (onlineIds.length === 0) {
      return "no online nodes";
    }

    // 2. map all latest online successes
    const allLastExitSuccesses = onlineIds.reduce(
        (acc, id) => {
            const rel = this.reliabilities.get(id)!;
            const successes = Reliability.getLastExitSuccesses(rel);
            const successesWid = successes.map(function(s) {
                return s.id = id;
            });
            acc.push({id, successes});
            return acc;
        }, []);

    // 3. sort them by date
    allLastExitSuccesses.sort(function(

    // 2. map last exits into ids
    const successfulExits = onlineIds
      .map((id) => {
        const rel = this.reliabilities.get(id)!;
        return { id, entry: Reliability.getLastExitSuccess(rel) };
      })
      // 3. filter successful
      .filter(function ({ entry }) {
        return !!entry;
      });

    // 3. sort by latest
    const latestSuccesses = successfulExits
      .sort(function ({ entry: { date: dateA } }, { entry: { date: dateB } }) {
        return dateB - dateA;
      })
      // 4. discard last exits
      .map(function ({ id }) {
        return id;
      })
      // 4. take first five
      .slice(0, 5);

    // 5. filter unused online nodes
    const unusedOnlineIds = onlineIds.filter(function (id) {
      return !latestSuccesses.includes(id);
    });

    // 6. give a random online node a chance of 1% to avoid total node starvation
    if (unusedOnlineIds.length > 0 && Math.random() < 0.01) {
      const id = randomEl(unusedOnlineIds);
      const entryNode = this.entryNodes.get(id)!;
    }
  };
}

function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
