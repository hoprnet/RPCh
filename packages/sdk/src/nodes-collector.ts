import * as DPapi from './dp-api';
import * as NodePair from './node-pair';
import * as NodeSel from './node-selector';
import * as Request from './request';
import * as Res from './result';
import * as Segment from './segment';
import { logger } from './utils';

import type { MessageListener } from './node-pair';
import type { EntryNode } from './entry-node';
import type { NodeMatch } from './node-match';

export type VersionListener = (versions: DPapi.Versions) => void;

const log = logger(['sdk', 'nodes-collector']);

const NodePairFetchTimeout = 10e3; // 10 seconds downtime to avoid repeatedly querying DP
const NodePairAmount = 10; // how many routes do we fetch

export default class NodesCollector {
    private readonly nodePairs: Map<string, NodePair.NodePair> = new Map();
    private lastFetchNodePairs = 0;
    private lastMatchedAt = new Date(0);
    private ongoingFetchPairs = false;

    constructor(
        private readonly discoveryPlatformEndpoint: string,
        private readonly clientId: string,
        private readonly applicationTag: number,
        private readonly messageListener: MessageListener,
        private readonly versionListener: VersionListener,
        private readonly hops: number,
        private readonly forceManualRelaying: boolean,
    ) {
        this.fetchNodePairs();
    }

    public destruct = () => {
        for (const np of this.nodePairs.values()) {
            NodePair.destruct(np);
        }
        this.nodePairs.clear();
    };

    /**
     * Ready for request receival.
     */
    public ready = async (timeout: number): Promise<boolean> => {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                const now = Date.now();
                const elapsed = now - start;
                const res = NodeSel.routePair(this.nodePairs);
                if (Res.isOk(res)) {
                    log.verbose('ready with route pair: %s', NodeSel.prettyPrint(res.res));
                    return resolve(true);
                }
                if (elapsed > timeout) {
                    log.error('timeout after %d waiting for ready: %s', elapsed, res.error);
                    return reject(`timeout after ${elapsed} ms`);
                }
                setTimeout(check, 100);
            };
            check();
        });
    };

    /**
     * Request primary node pair.
     */
    public requestNodePair = async (timeout: number): Promise<NodeMatch> => {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                const now = Date.now();
                const elapsed = now - start;
                const res = NodeSel.routePair(this.nodePairs);
                if (Res.isOk(res)) {
                    log.verbose('found route pair: %s', NodeSel.prettyPrint(res.res));
                    return resolve(res.res.match);
                }
                if (elapsed > timeout) {
                    log.error('timeout after %d waiting for node pair: %s', elapsed, res.error);
                    return reject(`timeout after ${elapsed} ms`);
                }
                setTimeout(check, 100);
            };
            check();
        });
    };

    /**
     * Request secondary node pair.
     */
    public fallbackNodePair = (exclude: EntryNode): NodeMatch | undefined => {
        const res = NodeSel.fallbackRoutePair(this.nodePairs, exclude);
        if (Res.isOk(res)) {
            log.verbose('found fallback route pair: %s', NodeSel.prettyPrint(res.res));
            return res.res.match;
        }
    };

    public requestStarted = (req: Request.Request) => {
        const np = this.nodePairs.get(req.entryPeerId);
        if (!np) {
            log.error('started %s on non existing node pair', Request.prettyPrint(req));
            return;
        }
        NodePair.requestStarted(np, req);
        log.verbose('started %s on %s', Request.prettyPrint(req), NodePair.prettyPrint(np));
    };

    public requestSucceeded = (req: Request.Request, responseTime: number) => {
        const np = this.nodePairs.get(req.entryPeerId);
        if (!np) {
            log.error('successful %s on non existing node pair', Request.prettyPrint(req));
            return;
        }
        NodePair.requestSucceeded(np, req, responseTime);
        log.info('successful %s on %s', Request.prettyPrint(req), NodePair.prettyPrint(np));
    };

    public requestFailed = (req: Request.Request) => {
        const np = this.nodePairs.get(req.entryPeerId);
        if (!np) {
            log.error('failed %s on non exiting node pair', Request.prettyPrint(req));
            return;
        }
        NodePair.requestFailed(np, req);
        log.warn('failed %s on %s', Request.prettyPrint(req), NodePair.prettyPrint(np));
    };

    public segmentStarted = (req: Request.Request, seg: Segment.Segment) => {
        const np = this.nodePairs.get(req.entryPeerId);
        if (!np) {
            log.error('started %s on non existing node pair', Segment.prettyPrint(seg));
            return;
        }
        NodePair.segmentStarted(np, seg);
        log.verbose('started %s on %s', Segment.prettyPrint(seg), NodePair.prettyPrint(np));
    };

    public segmentSucceeded = (
        req: Request.Request,
        seg: Segment.Segment,
        responseTime: number,
    ) => {
        const np = this.nodePairs.get(req.entryPeerId);
        if (!np) {
            log.error('successful %s on non existing node pair', Segment.prettyPrint(seg), '');
            return;
        }
        NodePair.segmentSucceeded(np, seg, responseTime);
        log.info('successful %s on %s', Segment.prettyPrint(seg), NodePair.prettyPrint(np));
    };

    public segmentFailed = (req: Request.Request, seg: Segment.Segment) => {
        const np = this.nodePairs.get(req.entryPeerId);
        if (!np) {
            log.error('failed %s on non existing node pair', Segment.prettyPrint(seg));
            return;
        }
        NodePair.segmentFailed(np, seg);
        log.warn('failed %s on %s', Segment.prettyPrint(seg), NodePair.prettyPrint(np));
    };

    private fetchNodePairs = () => {
        if (this.ongoingFetchPairs) {
            log.verbose('discovering node pairs ongoing');
            return;
        }
        const diff = Date.now() - this.lastFetchNodePairs;
        if (diff < NodePairFetchTimeout) {
            log.verbose(
                'discovering node pairs too early - need to wait %dms',
                NodePairFetchTimeout - diff,
            );
        }
        this.ongoingFetchPairs = true;

        DPapi.fetchNodes(
            {
                discoveryPlatformEndpoint: this.discoveryPlatformEndpoint,
                clientId: this.clientId,
                forceZeroHop: this.hops === 0,
            },
            NodePairAmount,
            this.lastMatchedAt,
        )
            .then(this.initNodes)
            .catch((err) => {
                if (err.message === DPapi.NoMoreNodes) {
                    log.warn('no node pairs available');
                } else {
                    log.error('error fetching node pairs: %s[%o]', JSON.stringify(err), err);
                }
            })
            .finally(() => {
                this.lastFetchNodePairs = Date.now();
                this.ongoingFetchPairs = false;
            });
    };

    private initNodes = (nodes: DPapi.Nodes) => {
        const lookupExitNodes = new Map(nodes.exitNodes.map((x) => [x.id, x]));
        nodes.entryNodes
            .filter((en) => !this.nodePairs.has(en.id))
            .forEach((en) => {
                const exitNodes = en.recommendedExits.map((id) => lookupExitNodes.get(id)!);
                const np = NodePair.create(
                    en,
                    exitNodes,
                    this.applicationTag,
                    this.messageListener,
                    this.hops,
                    this.forceManualRelaying,
                );
                this.nodePairs.set(NodePair.id(np), np);
            });

        // reping all nodes
        this.nodePairs.forEach((np) => NodePair.discover(np));
        log.info(
            'discovered %d node-pairs with %d exits',
            this.nodePairs.size,
            lookupExitNodes.size,
        );
        this.versionListener(nodes.versions);
    };
}
