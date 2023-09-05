import * as NodeAPI from "./node-api";
import * as Request from "./request";
import * as Segment from "./segment";
import { average, createLogger, shortPeerId } from "./utils";

import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

export type MessageListener = (messages: NodeAPI.Message[]) => void;

// amound of history to keep
const MaxPerfHistory = 20;

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

export default class NodePair {
  public pingDuration?: number;
  public readonly exitNodes: Map<string, ExitNode>;
  public readonly entryData: EntryData = {
    segmentsOngoing: [],
    segmentsHistory: [],
    segments: new Map(),
    fetchMessagesLatencies: [],
    fetchMessagesSuccesses: 0,
    fetchMessagesErrors: 0,
    requestsOngoing: 0,
  };
  public readonly exitDatas: Map<string, ExitData> = new Map();

  private fetchInterval?: ReturnType<typeof setInterval>;
  private fetchMessagesOngoing: boolean = false;
  private readonly log;

  constructor(
    public readonly entryNode: EntryNode,
    exitNodes: Iterable<ExitNode>,
    private readonly applicationTag: number,
    private readonly messageListener: MessageListener
  ) {
    const shortId = shortPeerId(entryNode.id);
    this.log = createLogger([`nodepair${shortId}(${entryNode.apiEndpoint})`]);
    // ensure entry node not included in exits
    const exits = Array.from(exitNodes).filter((n) => entryNode.id !== n.id);
    this.exitNodes = new Map(exits.map((n) => [n.id, n]));
    this.exitDatas = new Map(
      exits.map((n) => [
        n.id,
        {
          requestsOngoing: [],
          requestsHistory: [],
          requests: new Map(),
        },
      ])
    );
  }

  // TODO
  public getExit = () => {
    for (const ex of this.exitNodes.values()) {
      return ex;
    }
  };

  public destruct() {
    clearInterval(this.fetchInterval);
  }

  public get id() {
    return this.entryNode.id;
  }

  public requestStarted = (req: Request.Request) => {
    const data = this.exitDatas.get(req.exitId);
    if (!data) {
      this.log.error(
        "requestStarted",
        Request.prettyPrint(req),
        "cannot track on missing exitId",
        this.prettyPrint()
      );
      return;
    }
    this.entryData.requestsOngoing++;
    data.requestsOngoing.push(req.id);
    data.requests.set(req.id, {
      startedAt: req.createdAt,
      state: State.Ongoing,
    });
    if (!this.fetchInterval) {
      this.fetchInterval = setInterval(this.fetchMessages, 250);
    }
  };

  /**
   * Record request success, return success count
   */
  public requestSucceeded = (req: Request.Request, responseTime: number) => {
    const data = this.exitDatas.get(req.exitId);
    if (!data) {
      this.log.error(
        "requestSucceeded",
        Request.prettyPrint(req),
        "cannot track on missing exitId",
        this.prettyPrint()
      );
      return;
    }

    this.updateReqHistory(data, req.id);
    this.checkStopInterval();

    const perf = data.requests.get(req.id);
    if (perf) {
      perf.state = State.Success;
      perf.latency = responseTime;
    }
  };

  public requestFailed = (req: Request.Request) => {
    const data = this.exitDatas.get(req.exitId);
    if (!data) {
      this.log.error(
        "requestFailed",
        Request.prettyPrint(req),
        "cannot track on missing exitId",
        this.prettyPrint()
      );
      return;
    }

    this.updateReqHistory(data, req.id);
    this.checkStopInterval();

    const perf = data.requests.get(req.id);
    if (perf) {
      perf.state = State.Failure;
    }
  };

  private updateReqHistory(data: ExitData, id: number) {
    this.entryData.requestsOngoing--;
    data.requestsOngoing = data.requestsOngoing.filter((rId) => rId !== id);
    data.requestsHistory.push(id);
    if (data.requestsHistory.length > MaxPerfHistory) {
      const rId = data.requestsHistory.shift() as number;
      data.requests.delete(rId);
    }
  }
  private checkStopInterval() {
    // stop interval if applicable
    if (this.entryData.requestsOngoing === 0) {
      clearInterval(this.fetchInterval);
      this.fetchInterval = undefined;
    }
  }

  public segmentStarted = (seg: Segment.Segment) => {
    const id = Segment.id(seg);
    this.entryData.segmentsOngoing.push(id);
    this.entryData.segments.set(id, {
      startedAt: Date.now(),
      state: State.Ongoing,
    });
  };

  public segmentSucceeded = (seg: Segment.Segment, responseTime: number) => {
    const id = Segment.id(seg);
    this.updateSegHistory(id);

    const perf = this.entryData.segments.get(id);
    if (perf) {
      perf.state = State.Success;
      perf.latency = responseTime;
    }
  };

  public segmentFailed = (seg: Segment.Segment) => {
    const id = Segment.id(seg);
    this.updateSegHistory(id);

    const perf = this.entryData.segments.get(id);
    if (perf) {
      perf.state = State.Failure;
    }
  };

  private updateSegHistory(id: string) {
    this.entryData.segmentsOngoing = this.entryData.segmentsOngoing.filter(
      (sId) => sId !== id
    );
    this.entryData.segmentsHistory.push(id);
    if (this.entryData.segmentsHistory.length > MaxPerfHistory) {
      const sId = this.entryData.segmentsHistory.shift() as string;
      this.entryData.segments.delete(sId);
    }
  }

  /**
   * Ping entry node version.
   */
  public ping = (): Promise<number> => {
    return new Promise((res) => {
      const startPingTime = Date.now();
      NodeAPI.version(this.entryNode).then((_) => {
        this.pingDuration = Date.now() - startPingTime;
        return res(this.pingDuration);
      });
    });
  };

  public prettyPrint = (): string => {
    const segOngoing = this.entryData.segmentsOngoing.length;
    const segTotal = this.entryData.segmentsHistory.length;
    const segLats = Array.from(this.entryData.segments.values()).reduce<
      number[]
    >((acc, sd) => {
      if (isSuccess(sd)) {
        acc.push(sd.latency);
      }
      return acc;
    }, []);

    const exCount = this.exitNodes.size;
    const exStrs = Array.from(this.exitDatas.values()).map((d) => {
      const o = d.requestsOngoing.length;
      const tot = d.requestsHistory.length;
      const lats = Array.from(d.requests.values()).reduce<number[]>(
        (acc, rd) => {
          if (isSuccess(rd)) {
            acc.push(rd.latency);
          }
          return acc;
        },
        []
      );
      return this.prettyOngoingNumbers(o, lats.length, tot, average(lats));
    });
    const segStr = this.prettyOngoingNumbers(
      segOngoing,
      segLats.length,
      segTotal,
      average(segLats)
    );
    const mesLat = average(this.entryData.fetchMessagesLatencies);
    const mesSuc = this.entryData.fetchMessagesSuccesses;
    const mesTot = mesSuc + this.entryData.fetchMessagesErrors;
    const mesStr = this.prettyOngoingNumbers(0, mesSuc, mesTot, mesLat);
    return `${shortPeerId(
      this.id
    )}_seg:${segStr}_msgs:${mesStr}_${exCount}x:${exStrs.join("-")}`;
  };

  private prettyOngoingNumbers(
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

  private fetchMessages = () => {
    const bef = Date.now();
    NodeAPI.retrieveMessages(this.entryNode, this.applicationTag)
      .then(({ messages }) => {
        const lat = Date.now() - bef;
        this.entryData.fetchMessagesSuccesses++;
        this.entryData.fetchMessagesLatencies.push(lat);
        if (this.entryData.fetchMessagesLatencies.length > MaxPerfHistory) {
          this.entryData.fetchMessagesLatencies.shift();
        }
        this.messageListener(messages);
      })
      .catch((err) => {
        this.log.error("Error fetching node messages", err);
        this.entryData.fetchMessagesErrors++;
      });
  };
}

function isSuccess(
  p: PerfData
): p is { state: State.Success; latency: number; startedAt: number } {
  return p.state === State.Success;
}
