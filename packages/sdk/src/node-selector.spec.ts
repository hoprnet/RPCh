import * as ExitData from './exit-data';
import * as NodePair from './node-pair';
import * as NodeSel from './node-selector';
import * as PerfData from './perf-data';

import type { EntryNode } from './entry-node';
import type { ExitNode } from './exit-node';

describe('test node selector', function () {
    it('selects only available route', function () {
        const xn = genExitNode('x');
        const en = genEntryNode('e', [xn.id]);
        const np = NodePair.create(en, [xn], 0, () => {});
        const nodePairs = new Map([[NodePair.id(np), np]]);
        const res = NodeSel.routePair(nodePairs);
        expect(res).toMatchObject({
            success: true,
            match: {
                entryNode: en,
                exitNode: xn,
            },
            via: 'only route available',
        });
    });

    it('selects quickest ping', function () {
        const xn1 = genExitNode('x1');
        const xn2 = genExitNode('x2');
        const en1 = genEntryNode('e1', [xn1.id]);
        const en2 = genEntryNode('e2', [xn2.id]);
        const np1 = NodePair.create(en1, [xn1], 0, () => {});
        const np2 = NodePair.create(en2, [xn2], 0, () => {});
        np1.entryData.pingDuration = 20;
        np2.entryData.pingDuration = 10;
        const nodePairs = new Map([
            [NodePair.id(np1), np1],
            [NodePair.id(np2), np2],
        ]);
        const res = NodeSel.routePair(nodePairs);
        expect(res).toMatchObject({
            success: true,
            match: {
                entryNode: en2,
                exitNode: xn2,
            },
            via: 'quickest version ping',
        });
    });

    it('selects best msgs latencies', function () {
        const xn1 = genExitNode('x1');
        const xn2 = genExitNode('x2');
        const xn3 = genExitNode('x3');
        const en1 = genEntryNode('e1', [xn1.id, xn2.id]);
        const en2 = genEntryNode('e2', [xn3.id]);
        const np1 = NodePair.create(en1, [xn1, xn2], 0, () => {});
        const np2 = NodePair.create(en2, [xn3], 0, () => {});
        np1.entryData.fetchMessagesSuccesses = 3;
        np1.entryData.fetchMessagesLatencies = [20, 20, 30];
        np2.entryData.fetchMessagesSuccesses = 3;
        np2.entryData.fetchMessagesLatencies = [10, 20, 30];
        const nodePairs = new Map([
            [NodePair.id(np1), np1],
            [NodePair.id(np2), np2],
        ]);
        const res = NodeSel.routePair(nodePairs);
        expect(res).toMatchObject({
            success: true,
            match: {
                entryNode: en2,
                exitNode: xn3,
            },
            via: 'best message retrieval latency',
        });
    });

    it('selects least msgs errors', function () {
        const xn1 = genExitNode('x1');
        const xn2 = genExitNode('x2');
        const xn3 = genExitNode('x3');
        const en1 = genEntryNode('e1', [xn1.id, xn2.id]);
        const en2 = genEntryNode('e2', [xn3.id]);
        const np1 = NodePair.create(en1, [xn1, xn2], 0, () => {});
        const np2 = NodePair.create(en2, [xn3], 0, () => {});
        np1.entryData.fetchMessagesErrors = 3;
        np2.entryData.fetchMessagesErrors = 2;
        const nodePairs = new Map([
            [NodePair.id(np1), np1],
            [NodePair.id(np2), np2],
        ]);
        const res = NodeSel.routePair(nodePairs);
        expect(res).toMatchObject({
            success: true,
            match: {
                entryNode: en2,
                exitNode: xn3,
            },
            via: 'least message retrieval errors',
        });
    });

    it('selects least seg ongoing', function () {
        const xn1 = genExitNode('x1');
        const xn2 = genExitNode('x2');
        const xn3 = genExitNode('x3');
        const en1 = genEntryNode('e1', [xn1.id, xn2.id]);
        const en2 = genEntryNode('e2', [xn3.id]);
        const np1 = NodePair.create(en1, [xn1, xn2], 0, () => {});
        const np2 = NodePair.create(en2, [xn3], 0, () => {});
        np1.entryData.segmentsOngoing = ['1', '2', '3'];
        np2.entryData.segmentsOngoing = ['1', '2'];
        const nodePairs = new Map([
            [NodePair.id(np1), np1],
            [NodePair.id(np2), np2],
        ]);
        const res = NodeSel.routePair(nodePairs);
        expect(res).toMatchObject({
            success: true,
            match: {
                entryNode: en2,
                exitNode: xn3,
            },
            via: 'least ongoing segments',
        });
    });

    it('selects best seg latencies', function () {
        const xn1 = genExitNode('x1');
        const xn2 = genExitNode('x2');
        const xn3 = genExitNode('x3');
        const en1 = genEntryNode('e1', [xn1.id, xn2.id]);
        const en2 = genEntryNode('e2', [xn3.id]);
        const np1 = NodePair.create(en1, [xn1, xn2], 0, () => {});
        const np2 = NodePair.create(en2, [xn3], 0, () => {});
        np1.entryData.segmentsHistory = ['1', '2', '3'];
        np2.entryData.segmentsHistory = ['1', '2'];
        np1.entryData.segments = new Map([
            ['1', genLat(20)],
            ['2', genLat(20)],
            ['3', genLat(30)],
        ]);
        np2.entryData.segments = new Map([
            ['1', genLat(20)],
            ['2', genLat(20)],
        ]);
        const nodePairs = new Map([
            [NodePair.id(np1), np1],
            [NodePair.id(np2), np2],
        ]);
        const res = NodeSel.routePair(nodePairs);
        expect(res).toMatchObject({
            success: true,
            match: {
                entryNode: en2,
                exitNode: xn3,
            },
            via: 'best segment latency',
        });
    });

    it('selects least seg errors', function () {
        const xn1 = genExitNode('x1');
        const xn2 = genExitNode('x2');
        const xn3 = genExitNode('x3');
        const en1 = genEntryNode('e1', [xn1.id, xn2.id]);
        const en2 = genEntryNode('e2', [xn3.id]);
        const np1 = NodePair.create(en1, [xn1, xn2], 0, () => {});
        const np2 = NodePair.create(en2, [xn3], 0, () => {});
        np1.entryData.segmentsHistory = ['1', '2', '3'];
        np2.entryData.segmentsHistory = ['1', '2'];
        np1.entryData.segments = new Map([
            ['1', genLat(10)],
            ['2', genLat(20)],
            ['3', genErr()],
        ]);
        np2.entryData.segments = new Map([
            ['1', genLat(20)],
            ['2', genLat(20)],
        ]);
        const nodePairs = new Map([
            [NodePair.id(np1), np1],
            [NodePair.id(np2), np2],
        ]);
        const res = NodeSel.routePair(nodePairs);
        expect(res).toMatchObject({
            success: true,
            match: {
                entryNode: en2,
                exitNode: xn3,
            },
            via: 'least segment errors',
        });
    });

    it('selects least ongoing reqs', function () {
        const xn1 = genExitNode('x1');
        const xn2 = genExitNode('x2');
        const xn3 = genExitNode('x3');
        const en1 = genEntryNode('e1', [xn1.id, xn2.id]);
        const en2 = genEntryNode('e2', [xn3.id]);
        const np1 = NodePair.create(en1, [xn1, xn2], 0, () => {});
        const np2 = NodePair.create(en2, [xn3], 0, () => {});
        np1.exitDatas = new Map([
            ['x1', genExitData({ requestsOngoing: [1, 2, 3] })],
            ['x2', genExitData({ requestsOngoing: [1, 2] })],
        ]);
        np2.exitDatas = new Map([['x3', genExitData({ requestsOngoing: [1, 2, 3] })]]);
        const nodePairs = new Map([
            [NodePair.id(np1), np1],
            [NodePair.id(np2), np2],
        ]);
        const res = NodeSel.routePair(nodePairs);
        expect(res).toMatchObject({
            success: true,
            match: {
                entryNode: en1,
                exitNode: xn2,
            },
            via: 'least ongoing requests',
        });
    });

    it('selects best request latency', function () {
        const xn1 = genExitNode('x1');
        const xn2 = genExitNode('x2');
        const xn3 = genExitNode('x3');
        const en1 = genEntryNode('e1', [xn1.id, xn2.id]);
        const en2 = genEntryNode('e2', [xn3.id]);
        const np1 = NodePair.create(en1, [xn1, xn2], 0, () => {});
        const np2 = NodePair.create(en2, [xn3], 0, () => {});
        np1.exitDatas = new Map([
            [
                'x1',
                genExitData({
                    requestsHistory: [1, 2],
                    requests: new Map([
                        [1, genLat(20)],
                        [2, genLat(30)],
                    ]),
                }),
            ],
            [
                'x2',
                genExitData({
                    requestsHistory: [1, 2, 3],
                    requests: new Map([
                        [1, genLat(10)],
                        [2, genLat(20)],
                        [3, genLat(20)],
                    ]),
                }),
            ],
        ]);
        np2.exitDatas = new Map([
            [
                'x3',
                genExitData({
                    requestsHistory: [1],
                    requests: new Map([[1, genLat(20)]]),
                }),
            ],
        ]);
        const nodePairs = new Map([
            [NodePair.id(np1), np1],
            [NodePair.id(np2), np2],
        ]);
        const res = NodeSel.routePair(nodePairs);
        expect(res).toMatchObject({
            success: true,
            match: {
                entryNode: en1,
                exitNode: xn2,
            },
            via: 'best request latency',
        });
    });

    it('selects least request errors', function () {
        const xn1 = genExitNode('x1');
        const xn2 = genExitNode('x2');
        const xn3 = genExitNode('x3');
        const en1 = genEntryNode('e1', [xn1.id, xn2.id]);
        const en2 = genEntryNode('e2', [xn3.id]);
        const np1 = NodePair.create(en1, [xn1, xn2], 0, () => {});
        const np2 = NodePair.create(en2, [xn3], 0, () => {});
        np1.exitDatas = new Map([
            [
                'x1',
                genExitData({
                    requestsHistory: [1, 2],
                    requests: new Map([
                        [1, genErr()],
                        [2, genLat(30)],
                    ]),
                }),
            ],
            [
                'x2',
                genExitData({
                    requestsHistory: [1, 2, 3],
                    requests: new Map([
                        [1, genLat(10)],
                        [2, genLat(20)],
                        [3, genLat(20)],
                    ]),
                }),
            ],
        ]);
        np2.exitDatas = new Map([
            [
                'x3',
                genExitData({
                    requestsHistory: [1],
                    requests: new Map([[1, genErr()]]),
                }),
            ],
        ]);
        const nodePairs = new Map([
            [NodePair.id(np1), np1],
            [NodePair.id(np2), np2],
        ]);
        const res = NodeSel.routePair(nodePairs);
        expect(res).toMatchObject({
            success: true,
            match: {
                entryNode: en1,
                exitNode: xn2,
            },
            via: 'least request errors',
        });
    });
});

function genEntryNode(id: string, recommendedExits: string[]): EntryNode {
    return {
        apiEndpoint: new URL('http://url.url'),
        accessToken: '',
        id,
        recommendedExits,
    };
}

function genExitNode(id: string): ExitNode {
    return {
        id,
        pubKey: '',
    };
}

function genLat(latency: number): PerfData.PerfData {
    return {
        startedAt: 0,
        latency,
        state: PerfData.State.Success,
    };
}

function genErr(): PerfData.PerfData {
    return {
        startedAt: 0,
        state: PerfData.State.Failure,
    };
}

function genExitData(additionals: any): ExitData.ExitData {
    return {
        requestsOngoing: [],
        requestsHistory: [],
        requests: new Map(),
        ...additionals,
    };
}
