import cors = require('cors');
import express, { Request, Response } from 'express';

import { Pool } from 'pg';
import { Utils } from '@rpch/sdk';
import { checkSchema, matchedData, query, validationResult } from 'express-validator';

import * as middleware from './middleware';
import * as quota from './quota';

import * as qConfigs from './../../../configs';
import * as qNode from './../../../node';

import type { Secrets } from './../../../secrets';

const log = Utils.logger(['discovery-platform', 'router']);

// Express Router
export const v1Router = (ops: { dbPool: Pool; secrets: Secrets; url: string }) => {
    const router = express.Router();
    router.use(cors({ origin: true, credentials: true }));
    router.use(express.json());

    // log entry calls
    router.use((req, _res, next) => {
        const { method, path, params, body } = req;
        log.verbose(`${method.toUpperCase()} ${path}`, {
            params,
            body,
        });
        next();
    });

    ///
    // nodes and routes

    router.get(
        '/nodes/pairings',
        middleware.clientAuthorized(ops.dbPool),
        query('amount').default(10).isInt({ min: 1, max: 100 }),
        query('force_zero_hop').optional().toBoolean(),
        query('client_associated').optional().toBoolean(),
        getNodesPairings(ops.dbPool)
    );

    ////
    // configs
    router.get(
        '/configs',
        middleware.clientAuthorized(ops.dbPool),
        query('key').isIn(Object.keys(qConfigs.Key)).exists(),
        getConfigKeys(ops.dbPool)
    );

    ////
    // quota

    router.post(
        '/quota/request',
        middleware.nodeAuthorized(ops.dbPool),
        checkSchema(quota.schema),
        middleware.validateStop,
        quota.request(ops.dbPool)
    );

    router.post(
        '/quota/response',
        middleware.nodeAuthorized(ops.dbPool),
        checkSchema(quota.schema),
        middleware.validateStop,
        quota.response(ops.dbPool)
    );

    return router;
};

function getNodesPairings(dbPool: Pool) {
    return async function (req: Request, res: Response) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errors.mapped());
        }

        const data = matchedData(req);
        const forceZeroHop = !!data.force_zero_hop;
        const clientAssociated = !!data.client_associated;
        qNode
            .listPairings(dbPool, data.amount, { forceZeroHop, clientAssociated })
            .then((qPairings) => {
                if (qPairings.length === 0) {
                    // table is empty
                    return res.status(204).end();
                }

                // collect pairings by entry node
                const pairings = qPairings.reduce<Map<string, Set<string>>>(
                    (acc, { entryId, exitId }) => {
                        const v = acc.get(entryId);
                        if (v) {
                            v.add(exitId);
                            return acc;
                        }
                        acc.set(entryId, new Set([exitId]));
                        return acc;
                    },
                    new Map()
                );

                // query entry and exit nodes
                const qEntryNodes = qNode.listEntryNodes(dbPool, pairings.keys());
                const exitIds = Array.from(pairings.values()).reduce((acc, xIds) => {
                    for (const xId of xIds) {
                        acc.add(xId);
                    }
                    return acc;
                }, new Set());
                const qExitNodes = qNode.listExitNodes(dbPool, exitIds);

                // wait for entry and exit nodes query results
                Promise.all([qEntryNodes, qExitNodes])
                    .then(([qEntries, qExits]) => {
                        const matchedAt = qPairings[0].createdAt;
                        const entryNodes = qEntries.map((e) => ({
                            ...e,
                            recommendedExits: Array.from(pairings.get(e.id) as Set<string>),
                        }));
                        return res.status(200).json({
                            entryNodes,
                            exitNodes: qExits,
                            matchedAt,
                        });
                    })
                    .catch((ex) => {
                        log.error('Error during read registered_nodes queries', ex);
                        const reason = 'Error querying database';
                        return res.status(500).json({ reason });
                    });
            })
            .catch((ex) => {
                log.error(
                    `Error during read ${forceZeroHop ? 'zero' : 'one'}_hop_pairings query`,
                    ex
                );
                const reason = 'Error querying database';
                return res.status(500).json({ reason });
            });
    };
}

function getConfigKeys(dbPool: Pool) {
    return async function (req: Request, res: Response) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errors.mapped());
        }

        const data = matchedData(req);
        const results = await qConfigs.list(dbPool, data.key);
        if (results.length === 0) {
            // no matching rows
            return res.status(204).end();
        }

        const obj = results.reduce<Record<string, string>>((acc, { key, data }) => {
            acc[key] = data;
            return acc;
        }, {});

        return res.status(200).json(obj);
    };
}
