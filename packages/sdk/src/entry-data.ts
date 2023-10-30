import * as NodeMatch from './node-match';
import * as PerfData from './perf-data';
import * as Segment from './segment';
import { average } from './utils';

export type Perf = {
    pingDuration: number;
    segOngoing: number;
    segFailures: number;
    segSuccesses: number;
    segTotal: number;
    segAvgLats: number;
    reqOngoing: number;
    msgsAvgLats: number;
    msgsFails: number;
};

export type EntryData = {
    pingDuration: number;
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
        pingDuration: 0,
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

export function recSuccessSeq(ed: EntryData, seg: Segment.Segment, dur: number) {
    const id = Segment.id(seg);
    ed.segmentsOngoing = ed.segmentsOngoing.filter((sId) => sId !== id);
    ed.segmentsHistory.push(id);
    if (ed.segmentsHistory.length > NodeMatch.MaxSegmentsHistory) {
        const sId = ed.segmentsHistory.shift() as string;
        ed.segments.delete(sId);
    }
    const perf = ed.segments.get(id);
    if (perf) {
        PerfData.success(perf, dur);
    }
}

export function recFailureSeq(ed: EntryData, seg: Segment.Segment) {
    const id = Segment.id(seg);
    ed.segmentsOngoing = ed.segmentsOngoing.filter((sId) => sId !== id);
    ed.segmentsHistory.push(id);
    if (ed.segmentsHistory.length > NodeMatch.MaxSegmentsHistory) {
        const sId = ed.segmentsHistory.shift() as string;
        ed.segments.delete(sId);
    }
    const perf = ed.segments.get(id);
    if (perf) {
        PerfData.failure(perf);
    }
}

export function perf(ed: EntryData): Perf {
    const segOngoing = ed.segmentsOngoing.length;
    const segTotal = ed.segmentsHistory.length;
    const latsRaw = ed.segmentsHistory.map((sId) => ed.segments.get(sId)?.latency);
    const lats = latsRaw.filter((l) => !!l) as number[];
    const segSuccesses = lats.length;
    const segFailures = segTotal - segSuccesses;
    const segAvgLats = average(lats);
    return {
        pingDuration: ed.pingDuration,
        segOngoing,
        segFailures,
        segSuccesses,
        segTotal,
        segAvgLats,
        reqOngoing: ed.requestsOngoing,
        msgsAvgLats: average(ed.fetchMessagesLatencies),
        msgsFails: ed.fetchMessagesErrors,
    };
}
