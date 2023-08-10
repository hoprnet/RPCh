import { MessageEvent } from "isomorphic-ws";
import { utils } from "ethers";

import type { Request } from "./request";
import NodePair, { type EntryNode, ExitNode, Pair } from "./node-pair";
import * as NodesAPI from "./nodes-api";
import { createLogger, shortPeerId } from "./utils";

const log = createLogger(["nodes-collector"]);

export default class NodesCollector {
  private readonly nodePairs: Map<string, NodePair> = new Map();
  private timerFetchPairs = setTimeout(function () {});
  private ongoingFetchPairs = false;

  constructor(
    private readonly discoveryPlatformEndpoint: string,
    private readonly clientId: string,
    private readonly onWSmessage: (message: string) => void
  ) {
    this.fetchNodePairs();
  }

  public stop = () => {
    log.verbose("stopping");
    for (const [, np] of this.nodePairs) {
      np.close();
    }
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
        for (const [, np] of this.nodePairs) {
          const res = np.readyExitNode();
          if (res.res === "ok") {
            return resolve(true);
          }
        }
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
  public requestNodePair = async (timeout: number): Promise<Pair> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const now = Date.now();
        const elapsed = now - start;
        for (const [, np] of this.nodePairs) {
          const res = np.readyExitNode();
          if (res.res === "ok") {
            np.messageListener = this.messageListener;
            return resolve({ entryNode: np.entryNode, exitNode: res.exitNode });
          }
        }
        if (elapsed > timeout) {
          log.error("Timeout waiting for node pair", elapsed);
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
  public requestFallbackNodePair = (pair: Pair): Pair | undefined => {
    for (const [id, np] of this.nodePairs) {
      if (id === pair.entryNode.peerId) {
        continue;
      }
      const res = np.readyExitNode();
      if (res.res === "ok") {
        np.messageListener = this.messageListener;
        return { entryNode: np.entryNode, exitNode: res.exitNode };
      }
    }
  };

  public requestStarted = ({ entryId, exitId, id }: Request) => {
    const np = this.nodePairs.get(entryId);
    const req = `${id}:${shortPeerId(entryId)}>${shortPeerId(exitId)}`;
    if (!np) {
      log.error("requestStarted", req, "on non exiting node pair");
      return;
    }
    const res = np.requestStarted(exitId);
    log.verbose(
      "requestStarted",
      req,
      "-",
      res,
      "ongoing requests on that route"
    );
  };

  public requestSucceeded = (
    { entryId, exitId, id }: Request,
    responseTime: number
  ) => {
    const np = this.nodePairs.get(entryId);
    const req = `${id}:${shortPeerId(entryId)}>${shortPeerId(exitId)}`;
    if (!np) {
      log.error("requestSucceeded", req, "on non exiting node pair");
      return;
    }
    const res = np.requestSucceeded(exitId, responseTime);
    log.verbose(
      "requestSucceeded",
      req,
      "-",
      res,
      "total successes on that route"
    );
  };

  public requestFailed = ({ entryId, exitId, id }: Request) => {
    const np = this.nodePairs.get(entryId);
    const req = `${id}:${shortPeerId(entryId)}>${shortPeerId(exitId)}`;
    if (!np) {
      log.error("requestSucceeded", req, "on non exiting node pair");
      return;
    }
    const res = np.requestFailed(exitId);
    log.verbose("requestFailed", req, "-", res, "failed on that route");
  };

  private fetchNodePairs = () => {
    clearTimeout(this.timerFetchPairs);
    if (this.ongoingFetchPairs) {
      return;
    }
    if (this.nodePairs.size >= NodePair.TargetAmount) {
      this.timerFetchPairs = setTimeout(this.fetchNodePairs, 30e3);
      return;
    }
    this.ongoingFetchPairs = true;
    const excludeList = Array.from(this.nodePairs.keys());
    NodesAPI.fetchEntryNode({
      excludeList,
      discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
      clientId: this.clientId,
    })
      .then((entryNode: EntryNode) => {
        const np = new NodePair(entryNode);
        this.nodePairs.set(np.id, np);
        np.connect();
        NodesAPI.fetchExitNodes({
          discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
          clientId: this.clientId,
        })
          .then((exitNodes: ExitNode[]) => {
            np.addExitNodes(exitNodes);
            setTimeout(this.fetchNodePairs);
          })
          .catch((err: any) => {
            log.error("Error fetching exit nodes", err);
            // for now restart the whole process to keep it consistent with one hop behaviour
            np.close();
            this.nodePairs.delete(np.id);
          });
      })
      .catch((err: any) => {
        log.error("Error fetching entry node", err);
      })
      .finally(() => {
        this.timerFetchPairs = setTimeout(this.fetchNodePairs);
      });
  };

  private messageListener = (event: MessageEvent) => {
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
}
