import * as NodeAPI from "./node-api";
import * as Request from "./request";
import * as Segment from "./segment";
import { average, createLogger, shortPeerId } from "./utils";

import type { EntryNode } from "./entry-node";
import type { ExitNode } from "./exit-node";

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

// segments measures quality of entry node
type EntryData = {
  segmentsOngoing: string[]; // sorted ongoing segment ids
  segmentsHistory: string[]; // sorted resolved segment ids
  segments: Map<string, PerfData>; // segment data
};

type MessageListener = {
  onMsgs: (messages: NodeAPI.Message[]) => void;
  onError: (err: Error) => void;
};

// requests measure quality of exit nodes
type ExitData = {
  requestsOngoing: number[]; // sorted ongoing request ids
  requestsHistory: number[]; // sorted resolved request ids
  requests: Map<number, PerfData>; // request data
};

export default class NodePair {
  private static PerfHistory = 20;

  public pingDuration?: number;
  private fetchInterval?: ReturnType<typeof setInterval>;
  private readonly log;
  private readonly exitNodes: Map<string, ExitNode>;
  private readonly entryData: EntryData = {
    segmentsOngoing: [],
    segmentsHistory: [],
    segments: new Map(),
  };
  private readonly exitDatas: Map<string, ExitData> = new Map();

  constructor(
    public readonly entryNode: EntryNode,
    exitNodes: Iterable<ExitNode>,
    private applicationTag: number,
    private messageListener: MessageListener
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

  public destruct() {
    clearInterval(this.fetchInterval);
  }

  public get id() {
    return this.entryNode.id;
  }

  public requestStarted = (req: Request.Request) => {
    const data = this.exitDatas.get(req.exitId)!;
    data.requestsOngoing.push(req.id);
    data.requests.set(req.id, {
      startedAt: req.createdAt,
      state: State.Ongoing,
    });
    if (!this.fetchInterval) {
      this.fetchInterval = setInterval(this.fetchMessages, 250);
    }
  };

  public requestSucceeded = (req: Request.Request, responseTime: number) => {
    const perf = this.requestDone(req);
    perf.state = State.Success;
    perf.latency = responseTime;
  };

  public requestFailed = (req: Request.Request) => {
    const perf = this.requestDone(req);
    perf.state = State.Failure;
  };

  private requestDone = (req: Request.Request) => {
    const data = this.exitDatas.get(req.exitId)!;
    data.requestsOngoing = data.requestsOngoing.filter((rId) => rId !== req.id);

    // stop interval if applicable
    if (data.requestsOngoing.length === 0) {
      clearInterval(this.fetchInterval);
      this.fetchInterval = undefined;
    }

    // update req history
    data.requestsHistory.push(req.id);
    if (data.requestsHistory.length > NodePair.PerfHistory) {
      const rId = data.requestsHistory.shift()!;
      data.requests.delete(rId);
    }
    // return perf data for updating
    return data.requests.get(req.id)!;
  };

  public segmentStarted = (seg: Segment.Segment) => {
    const id = Segment.id(seg);
    this.entryData.segmentsOngoing.push(id);
    this.entryData.segments.set(id, {
      startedAt: Date.now(),
      state: State.Ongoing,
    });
  };

  public segmentSucceeded = (seg: Segment.Segment, responseTime: number) => {
    const perf = this.segmentDone(seg);
    perf.state = State.Success;
    perf.latency = responseTime;
  };

  public segmentFailed = (seg: Segment.Segment) => {
    const perf = this.segmentDone(seg);
    perf.state = State.Failure;
  };

  private segmentDone = (seg: Segment.Segment) => {
    const id = Segment.id(seg);
    this.entryData.segmentsOngoing = this.entryData.segmentsOngoing.filter(
      (sId) => sId !== id
    );

    // update seg history
    this.entryData.segmentsHistory.push(id);
    if (this.entryData.segmentsHistory.length > NodePair.PerfHistory) {
      const sId = this.entryData.segmentsHistory.shift()!;
      this.entryData.segments.delete(sId);
    }

    // return perf data for updating
    return this.entryData.segments.get(id)!;
  };

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
    const eStr = this.prettyOngoingNumbers(
      segOngoing,
      segLats.length,
      segTotal,
      average(segLats)
    );
    return `${shortPeerId(this.id)}(${eStr})_${exCount}x:${exStrs.join("-")}`;
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
    NodeAPI.retrieveMessages(this.entryNode, this.applicationTag)
      .then(({ messages }) => this.messageListener.onMsgs(messages))
      .catch((err) => this.messageListener.onError(err));
  };
}

function isSuccess(
  p: PerfData
): p is { state: State.Success; latency: number; startedAt: number } {
  return p.state === State.Success;
}
