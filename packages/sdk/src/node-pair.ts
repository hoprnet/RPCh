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

// requests measure quality of exit nodes
type ExitData = {
  requestsOngoing: number[]; // sorted ongoing request ids
  requestsHistory: number[]; // sorted resolved request ids
  requests: Map<number, PerfData>; // request data
};

export default class NodePair {
  private static PerfHistory = 20;

  public pingDuration?: number;
  private readonly log;
  private readonly exitNodes: Map<string, ExitNode>;
  private readonly entryData: EntryData = {
    segmentsOngoing: [],
    segmentsHistory: [],
    segments: new Map(),
  };
  private readonly exitDatas: Map<string, ExitData> = new Map(); // exitId -> latencies

  constructor(
    public readonly entryNode: EntryNode,
    exitNodes: Iterable<ExitNode>
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
  };

  public requestSucceeded = (req: Request.Request, responseTime: number) => {
    const data = this.exitDatas.get(req.exitId)!;
    data.requestsOngoing = data.requestsOngoing.filter((rId) => rId !== req.id);
    data.requestsHistory.push(req.id);
    if (data.requestsHistory.length > NodePair.PerfHistory) {
      const rId = data.requestsHistory.shift()!;
      data.requests.delete(rId);
    }
    const perf = data.requests.get(req.id)!;
    perf.state = State.Success;
    perf.latency = responseTime;
  };

  public requestFailed = (req: Request.Request) => {
    const data = this.exitDatas.get(req.exitId)!;
    data.requestsOngoing = data.requestsOngoing.filter((rId) => rId !== req.id);
    data.requestsHistory.push(req.id);
    if (data.requestsHistory.length > NodePair.PerfHistory) {
      const rId = data.requestsHistory.shift()!;
      data.requests.delete(rId);
    }
    const perf = data.requests.get(req.id)!;
    perf.state = State.Failure;
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
    const id = Segment.id(seg);
    this.entryData.segmentsOngoing = this.entryData.segmentsOngoing.filter(
      (sId) => sId !== id
    );
    this.entryData.segmentsHistory.push(id);
    if (this.entryData.segmentsHistory.length > NodePair.PerfHistory) {
      const sId = this.entryData.segmentsHistory.shift()!;
      this.entryData.segments.delete(sId);
    }
    const perf = this.entryData.segments.get(id)!;
    perf.state = State.Success;
    perf.latency = responseTime;
  };

  public segmentFailed = (seg: Segment.Segment) => {
    const id = Segment.id(seg);
    this.entryData.segmentsOngoing = this.entryData.segmentsOngoing.filter(
      (sId) => sId !== id
    );
    this.entryData.segmentsHistory.push(id);
    if (this.entryData.segmentsHistory.length > NodePair.PerfHistory) {
      const sId = this.entryData.segmentsHistory.shift()!;
      this.entryData.segments.delete(sId);
    }
    const perf = this.entryData.segments.get(id)!;
    perf.state = State.Failure;
  };

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
}

function isSuccess(
  p: PerfData
): p is { state: State.Success; latency: number; startedAt: number } {
  return p.state === State.Success;
}
