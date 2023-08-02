import { WebSocket, MessageEvent } from "isomorphic-ws";
import { utils } from "ethers";

import type { Request } from "./request";
import * as Nodes from "./nodes";
import * as NodesAPI from "./nodes-api";
import { createLogger } from "./utils";

const log = createLogger(["nodes-collector"]);
const apiWebSocket = "/api/v2/messages/websocket";

export default class NodesCollector {
  private readonly nodes: Nodes.Nodes = Nodes.init();
  private actTimer: ReturnType<typeof setTimeout> = setTimeout(function () {});
  private ongoingFetchEntry = false;
  private ongoingFetchExit = false;
  private webSocketOpenings = new Set<string>();

  constructor(
    private readonly discoveryPlatformEndpoint: string,
    private readonly clientId: string,
    private readonly onWSmessage: (message: string) => void
  ) {}

  public stop = () => {
    Nodes.stop(this.nodes);
    clearTimeout(this.actTimer);
  };

  /**
   * Ready for request receival, no websocket yet.
   */
  public ready = async (timeout: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const now = Date.now();
        const elapsed = now - start;
        const res = Nodes.reachReady(this.nodes);
        if (res.cmd === "") {
          return resolve(true);
        }
        log.verbose("ready actOnCmd", res.cmd, Nodes.prettyPrint(this.nodes));
        this.actOnCmd(res);
        if (elapsed > timeout) {
          log.error("Timeout waiting for ready", elapsed);
          return reject(`timeout after ${elapsed} ms`);
        }
        setTimeout(check, 100);
      };
      check();
    });
  };

  /**
   * Requested node pair, needs websocket.
   */
  public requestNodePair = async (timeout: number): Promise<Nodes.Pair> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const now = Date.now();
        const elapsed = now - start;
        const res = Nodes.reachNodePair(this.nodes);
        if (res.nodePair) {
          return resolve(res.nodePair);
        }
        log.verbose(
          "requestNodePair actOnCmd",
          res.cmd,
          Nodes.prettyPrint(this.nodes)
        );
        this.actOnCmd(res);
        if (elapsed > timeout) {
          log.error("Timeout waiting for node pair", elapsed);
          return reject(`timeout after ${elapsed} ms`);
        }
        setTimeout(check, 100);
      };
      check();
    });
  };

  public requestStarted = ({ entryId, exitId, id }: Request) => {
    Nodes.requestStarted(this.nodes, { entryId, exitId }, id);
    log.verbose(
      "requestStarted",
      id,
      `${Nodes.prettyPrintEntry(this.nodes, entryId)}->${Nodes.prettyPrintExit(
        this.nodes,
        exitId
      )}`
    );
  };

  public requestSucceeded = (
    { entryId, exitId, id }: Request,
    responseTime: number
  ) => {
    const res = Nodes.requestSucceeded(
      this.nodes,
      { entryId, exitId },
      id,
      responseTime
    );
    log.verbose(
      "requestSucceeded",
      id,
      `${Nodes.prettyPrintEntry(this.nodes, entryId)}->${Nodes.prettyPrintExit(
        this.nodes,
        exitId
      )}`,
      "actOnCmd",
      res.cmd,
      Nodes.prettyPrint(this.nodes)
    );
    this.actOnCmd(res);
  };

  public requestFailed = ({ entryId, exitId, id }: Request) => {
    const res = Nodes.requestFailed(this.nodes, { entryId, exitId }, id);
    log.verbose(
      "requestFailed",
      id,
      `${Nodes.prettyPrintEntry(this.nodes, entryId)}->${Nodes.prettyPrintExit(
        this.nodes,
        exitId
      )}`,
      "actOnCmd",
      res.cmd,
      Nodes.prettyPrint(this.nodes)
    );
    this.actOnCmd(res);
  };

  private actOnCmd = (cmd: Nodes.Command) => {
    clearTimeout(this.actTimer);
    switch (cmd.cmd) {
      case "needEntryNode":
        this.fetchEntryNode(cmd.excludeIds);
        break;
      case "needExitNode":
        this.fetchExitNodes();
        break;
      case "openWebSocket":
        this.openWebSocket(cmd.entryNode);
        break;
      case "stateError":
        log.error("Internal state error", cmd.info);
        break;
      default:
        break;
    }
  };

  private fetchEntryNode = (excludeIds: string[]) => {
    if (this.ongoingFetchEntry) {
      return;
    }
    this.ongoingFetchEntry = true;
    NodesAPI.fetchEntryNode({
      excludeList: excludeIds,
      discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
      clientId: this.clientId,
    })
      .then(this.onEntryNode)
      .catch(this.onEntryNodeError)
      .finally(() => {
        this.ongoingFetchEntry = false;
      });
  };

  private onEntryNode = (entryNode: Nodes.EntryNode) => {
    Nodes.newEntryNode(this.nodes, entryNode);
  };

  private onEntryNodeError = (err: string) => {
    log.error("Error requesting entry node", err);
    this.actTimer = setTimeout(() => {
      const res = Nodes.reachReady(this.nodes);
      log.verbose(
        "timer after onEntryNodeError reachReady",
        err,
        "actOnCmd",
        res.cmd,
        Nodes.prettyPrint(this.nodes)
      );
      this.actOnCmd(res);
    }, 555);
  };

  private fetchExitNodes = () => {
    if (this.ongoingFetchExit) {
      return;
    }
    this.ongoingFetchExit = true;
    NodesAPI.fetchExitNodes({
      discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
      clientId: this.clientId,
    })
      .then(this.onExitNodes)
      .catch(this.onExitNodesError)
      .finally(() => {
        this.ongoingFetchExit = false;
      });
  };

  private onExitNodes = (exitNodes: Nodes.ExitNode[]) => {
    Nodes.addExitNodes(this.nodes, exitNodes);
  };

  private onExitNodesError = (err: string) => {
    log.error("Error requesting exit nodes", err);
    this.actTimer = setTimeout(() => {
      const res = Nodes.reachReady(this.nodes);
      log.verbose(
        "timer after onExitNodesError reachReady",
        err,
        "actOnCmd",
        res.cmd,
        Nodes.prettyPrint(this.nodes)
      );
      this.actOnCmd(res);
    }, 555);
  };

  private openWebSocket = (entryNode: Nodes.EntryNode) => {
    if (this.webSocketOpenings.has(entryNode.peerId)) {
      return;
    }
    this.webSocketOpenings.add(entryNode.peerId);
    const wsURL = new URL(entryNode.apiEndpoint.toString());
    wsURL.protocol =
      entryNode.apiEndpoint.protocol === "https:" ? "wss:" : "ws:";
    wsURL.pathname = apiWebSocket;
    wsURL.search = `?apiToken=${entryNode.accessToken}`;
    const socket = new WebSocket(wsURL);
    Nodes.addWebSocket(this.nodes, entryNode, socket);
    socket.on("open", () => {
      log.info("WS open", Nodes.prettyPrintEntry(this.nodes, entryNode.peerId));
      this.webSocketOpenings.delete(entryNode.peerId);
    });
    socket.on("error", (err) => {
      log.error(
        "WS error",
        Nodes.prettyPrintEntry(this.nodes, entryNode.peerId),
        err
      );
      this.webSocketOpenings.delete(entryNode.peerId);
    });
    socket.on("close", () => {
      log.info(
        "WS close",
        Nodes.prettyPrintEntry(this.nodes, entryNode.peerId)
      );
      this.webSocketOpenings.delete(entryNode.peerId);
    });
    socket.onmessage = (event: MessageEvent) => {
      const body = event.data.toString();
      // message received is an acknowledgement of a
      // message we have send, we can safely ignore this
      if (body.startsWith("ack:")) {
        return;
      }

      let msg: string | undefined;
      try {
        msg = utils.toUtf8String(
          utils.RLP.decode(new Uint8Array(JSON.parse(`[${body}]`)))[0]
        );
      } catch (error) {
        log.error("Error decoding message:", error);
        return;
      }
      this.onWSmessage(msg);
    };
  };
}
