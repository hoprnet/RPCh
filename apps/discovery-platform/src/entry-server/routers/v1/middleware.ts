import { Utils } from '@rpch/sdk';
import { validationResult } from 'express-validator';
import type { Pool } from 'pg';
import type { NextFunction, Request, Response } from 'express';

import * as client from '../../../client';
import * as node from '../../../node';

const log = Utils.logger(['discovery-platform', 'router', 'middleware']);

export function clientAuthorized(dbPool: Pool) {
    return async function (req: Request, res: Response, next: NextFunction) {
        const clientId = req.headers['x-rpch-client'] as string;
        const result = await client
            .listIdsByExternalToken(dbPool, clientId)
            .catch((ex) => log.error('Error reading clientIds', ex));
        if (result && result.length > 0) {
            next();
        } else {
            const reason = 'Client not authorized';
            res.status(403).json({ reason }).end();
        }
    };
}

export function nodeAuthorized(dbPool: Pool) {
    return async function (req: Request & { nodeId?: string }, res: Response, next: NextFunction) {
        const accessToken = req.headers['x-rpch-node'] as string;
        const result = await node
            .listIdsByAccessToken(dbPool, accessToken)
            .catch((ex) => log.error('Error reading node tokens', ex));

        if (result && result.length > 0) {
            const res = result[0];
            req.nodeId = res.exitId;
            next();
        } else {
            const reason = 'Node not authorized';
            res.status(403).json({ reason }).end();
        }
    };
}

export function adminAuthorized(adminSecret: string) {
    return function (req: Request, res: Response, next: NextFunction) {
        const headerSecret = req.headers['x-secret-key'] as string;
        if (adminSecret === headerSecret) {
            next();
        } else {
            const reason = 'Not authorized';
            res.status(403).json({ reason }).end();
        }
    };
}

export function validateStop(req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        next();
    } else {
        res.status(400).json(errors.mapped());
    }
}
