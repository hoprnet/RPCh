import * as NodeAPI from "./node-api";
import * as Request from "./request";
import * as Segment from "./segment";
import * as EntryData from "./entry-data";
import * as ExitData from "./exit-data";
import * as PerfData from "./perf-data";
import { average, createLogger, shortPeerId } from "./utils";

import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

export type MessageListener = (messages: NodeAPI.Message[]) => void;

// amound of history to keep
const MaxPerfHistory = 20;
const MessagesFetchInterval = 333; // ms

export type NodePair = {
  entryNode: EntryNode;
  entryData: EntryData.EntryData;
  exitNodes: Map<string, ExitNode>;
  exitDatas: Map<string, ExitData.ExitData>;
  applicationTag: number;
  messageListener: MessageListener;
  fetchInterval?: ReturnType<typeof setInterval>;
  fetchMessagesOngoing: boolean;
  logger: ReturnType<typeof createLogger>;
};

export function create(
  entryNode: EntryNode,
  exitNodesIt: Iterable<ExitNode>,
  applicationTag: number,
  messageListener: MessageListener
): NodePair {
  const entryData = EntryData.create();
  const shortId = shortPeerId(entryNode.id);
  const logger = createLogger([`nodepair${shortId}(${entryNode.apiEndpoint})`]);
  // ensure entry node not included in exits
  const exits = Array.from(exitNodesIt).filter((n) => entryNode.id !== n.id);
  const exitNodes = new Map(exits.map((n) => [n.id, n]));
  const exitDatas = new Map(exits.map((n) => [n.id, ExitData.create()]));
  return {
    entryNode,
    entryData,
    exitNodes,
    exitDatas,
    applicationTag,
    messageListener,
    fetchMessagesOngoing: false,
    logger,
  };
}

export function destruct(np: NodePair) {
  clearInterval(np.fetchInterval);
}

export function id(np: NodePair) {
  return np.entryNode.id;
}

export function requestStarted(np: NodePair, req: Request.Request) {
  const data = np.exitDatas.get(req.exitId);
  if (!data) {
    np.logger.error(
      "requestStarted",
      Request.prettyPrint(req),
      "cannot track on missing exitId",
      prettyPrint(np)
    );
    return;
  }
  EntryData.addOngoingReq(np.entryData);
  ExitData.addOngoing(data, req);
  if (!np.fetchInterval) {
    np.fetchInterval = setInterval(
      () => fetchMessages(np),
      MessagesFetchInterval
    );
  }
}
export function requestSucceeded(
  np: NodePair,
  req: Request.Request,
  responseTime: number
) {
  const data = np.exitDatas.get(req.exitId);
  if (!data) {
    np.logger.error(
      "requestSucceeded",
      Request.prettyPrint(req),
      "cannot track on missing exitId",
      prettyPrint(np)
    );
    return;
  }

  EntryData.removeOngoingReq(np.entryData);
  ExitData.recSuccess(data, req, MaxPerfHistory, responseTime);
  checkStopInterval(np);
}

export function requestFailed(np: NodePair, req: Request.Request) {
  const data = np.exitDatas.get(req.exitId);
  if (!data) {
    np.logger.error(
      "requestFailed",
      Request.prettyPrint(req),
      "cannot track on missing exitId",
      prettyPrint(np)
    );
    return;
  }

  EntryData.removeOngoingReq(np.entryData);
  ExitData.recFailed(data, req, MaxPerfHistory);
  checkStopInterval(np);
}

function checkStopInterval(np: NodePair) {
  // stop interval if applicable
  if (np.entryData.requestsOngoing === 0) {
    clearInterval(np.fetchInterval);
    np.fetchInterval = undefined;
  }
}

export function segmentStarted(np: NodePair, seg: Segment.Segment) {
  EntryData.addOngoingSeg(np.entryData, seg);
}

export function segmentSucceeded(
  np: NodePair,
  seg: Segment.Segment,
  responseTime: number
) {
  EntryData.recSuccessSeq(np.entryData, seg, MaxPerfHistory, responseTime);
}

export function segmentFailed(np: NodePair, seg: Segment.Segment) {
  EntryData.recFailureSeq(np.entryData, seg, MaxPerfHistory);
}

/**
 * Ping entry node version.
 */
export function ping(np: NodePair): Promise<number> {
  return new Promise((res) => {
    const startPingTime = Date.now();
    NodeAPI.version(np.entryNode).then((_) => {
      np.entryData.pingDuration = Date.now() - startPingTime;
      return res(np.entryData.pingDuration);
    });
  });
}

export function prettyPrint(np: NodePair): string {
  const segOngoing = np.entryData.segmentsOngoing.length;
  const segTotal = np.entryData.segmentsHistory.length;
  const segLats = Array.from(np.entryData.segments.values()).reduce<number[]>(
    (acc, sd) => {
      if (PerfData.isSuccess(sd)) {
        acc.push(sd.latency);
      }
      return acc;
    },
    []
  );

  const exCount = np.exitNodes.size;
  const exStrs = Array.from(np.exitDatas).map(([id, d]) => {
    const o = d.requestsOngoing.length;
    const tot = d.requestsHistory.length;
    const lats = Array.from(d.requests.values()).reduce<number[]>((acc, rd) => {
      if (PerfData.isSuccess(rd)) {
        acc.push(rd.latency);
      }
      return acc;
    }, []);
    const str = prettyOngoingNumbers(np, o, lats.length, tot, average(lats));
    const nId = shortPeerId(id);
    return `${nId}[${str}]`;
  });
  const segStr = prettyOngoingNumbers(
    np,
    segOngoing,
    segLats.length,
    segTotal,
    average(segLats)
  );
  const mesLat = average(np.entryData.fetchMessagesLatencies);
  const mesSuc = np.entryData.fetchMessagesSuccesses;
  const mesTot = mesSuc + np.entryData.fetchMessagesErrors;
  const mesStr = prettyOngoingNumbers(np, 0, mesSuc, mesTot, mesLat);
  const ping = np.entryData.pingDuration
    ? `${np.entryData.pingDuration}ms`
    : "..";
  return `${shortPeerId(
    id(np)
  )}[ping: ${ping}, seg: ${segStr}, msgs: ${mesStr}, ${exCount}x: ${exStrs.join(
    ", "
  )}]`;
}

function prettyOngoingNumbers(
  np: NodePair,
  ongoing: number,
  successes: number,
  total: number,
  average: number
) {
  if (total === 0) {
    if (ongoing === 0) {
      return "0";
    }
    return `0+${ongoing}`;
  }
  const sDone = `${successes}(${average.toFixed(0)}ms)/${total}`;
  if (ongoing === 0) {
    return sDone;
  }
  return `${sDone}+${ongoing}`;
}

function fetchMessages(np: NodePair) {
  const bef = Date.now();
  NodeAPI.retrieveMessages(np.entryNode, np.applicationTag)
    .then(({ messages }) => {
      const lat = Date.now() - bef;
      np.entryData.fetchMessagesSuccesses++;
      np.entryData.fetchMessagesLatencies.push(lat);
      if (np.entryData.fetchMessagesLatencies.length > MaxPerfHistory) {
        np.entryData.fetchMessagesLatencies.shift();
      }
      np.messageListener(messages);
    })
    .catch((err) => {
      np.logger.error("Error fetching node messages", err);
      np.entryData.fetchMessagesErrors++;
    });
}
