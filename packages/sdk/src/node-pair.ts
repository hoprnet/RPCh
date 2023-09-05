import * as NodeAPI from "./node-api";
import * as Request from "./request";
import * as Segment from "./segment";
import { average, createLogger, shortPeerId } from "./utils";

import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

export type MessageListener = (messages: NodeAPI.Message[]) => void;

// amound of history to keep
const MaxPerfHistory = 20;
const MessagesFetchInterval = 333; // ms

enum State {
  Ongoing,
  Success,
  Failure,
}

type PerfData = {
  startedAt: number;
  latency?: number;
  state: State;
};

// Segments measures quality of entry node.
// Segment nr and request id are used in combination as keys for performance data.
// Since those cannot be ensured to be unique we need to check when retrieving PerfData.
// However this should not be an issue since it is transient data anyway.
type EntryData = {
  segmentsOngoing: string[]; // sorted ongoing segment ids
  segmentsHistory: string[]; // sorted resolved segment ids
  segments: Map<string, PerfData>; // segment data
  fetchMessagesLatencies: number[]; // last fetch messages latencies
  fetchMessagesSuccesses: number; // count of successful message fetches
  fetchMessagesErrors: number; // count of error message fetches
  requestsOngoing: number; // count of ongoing requests
};

// requests measure quality of exit nodes
type ExitData = {
  requestsOngoing: number[]; // sorted ongoing request ids
  requestsHistory: number[]; // sorted resolved request ids
  requests: Map<number, PerfData>; // request data
};

export type NodePair = {
  pingDuration?: number;
  entryNode: EntryNode;
  entryData: EntryData;
  exitNodes: Map<string, ExitNode>;
  exitDatas: Map<string, ExitData>;
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
  const entryData = {
    segmentsOngoing: [],
    segmentsHistory: [],
    segments: new Map(),
    fetchMessagesLatencies: [],
    fetchMessagesSuccesses: 0,
    fetchMessagesErrors: 0,
    requestsOngoing: 0,
  };
  const shortId = shortPeerId(entryNode.id);
  const logger = createLogger([`nodepair${shortId}(${entryNode.apiEndpoint})`]);
  // ensure entry node not included in exits
  const exits = Array.from(exitNodesIt).filter((n) => entryNode.id !== n.id);
  const exitNodes = new Map(exits.map((n) => [n.id, n]));
  const exitDatas = new Map(
    exits.map((n) => [
      n.id,
      {
        requestsOngoing: [],
        requestsHistory: [],
        requests: new Map(),
      },
    ])
  );
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
  np.entryData.requestsOngoing++;
  data.requestsOngoing.push(req.id);
  data.requests.set(req.id, {
    startedAt: req.createdAt,
    state: State.Ongoing,
  });
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

  updateReqHistory(np, data, req.id);
  checkStopInterval(np);

  const perf = data.requests.get(req.id);
  if (perf) {
    perf.state = State.Success;
    perf.latency = responseTime;
  }
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

  updateReqHistory(np, data, req.id);
  checkStopInterval(np);

  const perf = data.requests.get(req.id);
  if (perf) {
    perf.state = State.Failure;
  }
}

function updateReqHistory(np: NodePair, data: ExitData, id: number) {
  np.entryData.requestsOngoing--;
  data.requestsOngoing = data.requestsOngoing.filter((rId) => rId !== id);
  data.requestsHistory.push(id);
  if (data.requestsHistory.length > MaxPerfHistory) {
    const rId = data.requestsHistory.shift() as number;
    data.requests.delete(rId);
  }
}
function checkStopInterval(np: NodePair) {
  // stop interval if applicable
  if (np.entryData.requestsOngoing === 0) {
    clearInterval(np.fetchInterval);
    np.fetchInterval = undefined;
  }
}

export function segmentStarted(np: NodePair, seg: Segment.Segment) {
  const id = Segment.id(seg);
  np.entryData.segmentsOngoing.push(id);
  np.entryData.segments.set(id, {
    startedAt: Date.now(),
    state: State.Ongoing,
  });
}

export function segmentSucceeded(
  np: NodePair,
  seg: Segment.Segment,
  responseTime: number
) {
  const id = Segment.id(seg);
  updateSegHistory(np, id);

  const perf = np.entryData.segments.get(id);
  if (perf) {
    perf.state = State.Success;
    perf.latency = responseTime;
  }
}

export function segmentFailed(np: NodePair, seg: Segment.Segment) {
  const id = Segment.id(seg);
  updateSegHistory(np, id);

  const perf = np.entryData.segments.get(id);
  if (perf) {
    perf.state = State.Failure;
  }
}

function updateSegHistory(np: NodePair, id: string) {
  np.entryData.segmentsOngoing = np.entryData.segmentsOngoing.filter(
    (sId) => sId !== id
  );
  np.entryData.segmentsHistory.push(id);
  if (np.entryData.segmentsHistory.length > MaxPerfHistory) {
    const sId = np.entryData.segmentsHistory.shift() as string;
    np.entryData.segments.delete(sId);
  }
}

/**
 * Ping entry node version.
 */
export function ping(np: NodePair): Promise<number> {
  return new Promise((res) => {
    const startPingTime = Date.now();
    NodeAPI.version(np.entryNode).then((_) => {
      np.pingDuration = Date.now() - startPingTime;
      return res(np.pingDuration);
    });
  });
}

export function prettyPrint(np: NodePair): string {
  const segOngoing = np.entryData.segmentsOngoing.length;
  const segTotal = np.entryData.segmentsHistory.length;
  const segLats = Array.from(np.entryData.segments.values()).reduce<number[]>(
    (acc, sd) => {
      if (isSuccess(sd)) {
        acc.push(sd.latency);
      }
      return acc;
    },
    []
  );

  const exCount = np.exitNodes.size;
  const exStrs = Array.from(np.exitDatas.values()).map((d) => {
    const o = d.requestsOngoing.length;
    const tot = d.requestsHistory.length;
    const lats = Array.from(d.requests.values()).reduce<number[]>((acc, rd) => {
      if (isSuccess(rd)) {
        acc.push(rd.latency);
      }
      return acc;
    }, []);
    return prettyOngoingNumbers(np, o, lats.length, tot, average(lats));
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
  return `${shortPeerId(
    id(np)
  )}_seg:${segStr}_msgs:${mesStr}_${exCount}x:${exStrs.join("-")}`;
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
  const sDone = `${successes}(${average}ms)/${total}`;
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

function isSuccess(p: PerfData): p is {
  state: State.Success;
  latency: number;
  startedAt: number;
} {
  return p.state === State.Success;
}
