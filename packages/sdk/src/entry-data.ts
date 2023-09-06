import * as PerfData from "./perf-data";
import * as Segment from "./segment";

// Segments measures quality of entry node.
// Segment nr and request id are used in combination as keys for performance data.
// Since those cannot be ensured to be unique we need to check when retrieving PerfData.
// However this should not be an issue since it is transient data anyway.
export type EntryData = {
  segmentsOngoing: string[]; // sorted ongoing segment ids
  segmentsHistory: string[]; // sorted resolved segment ids
  segments: Map<string, PerfData.PerfData>; // segment data
  fetchMessagesLatencies: number[]; // last fetch messages latencies
  fetchMessagesSuccesses: number; // count of successful message fetches
  fetchMessagesErrors: number; // count of error message fetches
  requestsOngoing: number; // count of ongoing requests
};

export function create(): EntryData {
  return {
    segmentsOngoing: [],
    segmentsHistory: [],
    segments: new Map(),
    fetchMessagesLatencies: [],
    fetchMessagesSuccesses: 0,
    fetchMessagesErrors: 0,
    requestsOngoing: 0,
  };
}

export function addOngoingReq(ed: EntryData) {
  ed.requestsOngoing++;
}

export function removeOngoingReq(ed: EntryData) {
  ed.requestsOngoing--;
}

export function addOngoingSeg(ed: EntryData, seg: Segment.Segment) {
  const id = Segment.id(seg);
  ed.segmentsOngoing.push(id);
  ed.segments.set(id, PerfData.ongoing());
}

export function recSuccessSeq(
  ed: EntryData,
  seg: Segment.Segment,
  maxHistory: number,
  dur: number
) {
  const id = Segment.id(seg);
  ed.segmentsOngoing = ed.segmentsOngoing.filter((sId) => sId !== id);
  ed.segmentsHistory.push(id);
  if (ed.segmentsHistory.length > maxHistory) {
    const sId = ed.segmentsHistory.shift() as string;
    ed.segments.delete(sId);
  }
  const perf = ed.segments.get(id);
  if (perf) {
    PerfData.success(perf, dur);
  }
}

export function recFailureSeq(
  ed: EntryData,
  seg: Segment.Segment,
  maxHistory: number
) {
  const id = Segment.id(seg);
  ed.segmentsOngoing = ed.segmentsOngoing.filter((sId) => sId !== id);
  ed.segmentsHistory.push(id);
  if (ed.segmentsHistory.length > maxHistory) {
    const sId = ed.segmentsHistory.shift() as string;
    ed.segments.delete(sId);
  }
  const perf = ed.segments.get(id);
  if (perf) {
    PerfData.failure(perf);
  }
}
