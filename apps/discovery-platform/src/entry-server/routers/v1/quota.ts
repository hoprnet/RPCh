import { Utils } from '@rpch/sdk';
import type { Pool } from 'pg';
import type { Request, Response } from 'express';
import { ParamSchema } from 'express-validator';

import * as client from '../../../client';
import * as quota from '../../../quota';

const log = Utils.logger(['discovery-platform', 'router', 'quota']);

export type ReqNodeAuthed = Request & { nodeId: string };

export const schema: Record<keyof quota.Attrs & 'clientId', ParamSchema> = {
    clientId: {
        in: 'body',
        isString: true,
    },
    segmentCount: {
        in: 'body',
        isInt: true,
        toInt: true,
    },
    rpcMethod: {
        in: 'body',
        isString: true,
        optional: true,
    },
    lastSegmentLength: {
        in: 'body',
        isInt: true,
        toInt: true,
        optional: true,
    },
};

export function request(dbPool: Pool) {
    return async function (req: Request & { nodeId?: string }, res: Response) {
        validate(dbPool, req, res).then((clientId) => {
            quota
                .createRequest(dbPool, req.nodeId as string, clientId, req.body)
                .then(() => {
                    res.status(204).end();
                })
                .catch((err) => {
                    log.error('Error during create request quota query', err);
                    res.status(500).end();
                });
        });
    };
}

export function response(dbPool: Pool) {
    return async function (req: Request & { nodeId?: string }, res: Response) {
        validate(dbPool, req, res).then((clientId) => {
            quota
                .createResponse(dbPool, req.nodeId as string, clientId, req.body)
                .then(() => {
                    res.status(204).end();
                })
                .catch((err) => {
                    log.error('Error during create response quota query', err);
                    res.status(500).end();
                });
        });
    };
}

async function validate(
    dbPool: Pool,
    req: Request & { nodeId?: string },
    res: Response,
): Promise<string> {
    if (!('nodeId' in req)) {
        log.error('Expecting authorized node');
        res.status(500).end();
        return Promise.reject();
    }
    const resClient = await client.listIdsByExternalToken(dbPool, req.body.clientId).catch((ex) => {
        log.error('Error during listIdsByExternalToken', ex);
    });
    if (!resClient) {
        res.status(500).end();
        return Promise.reject();
    }
    if (resClient.length === 0) {
        res.status(403).json({ error: 'clientId not found' });
        return Promise.reject();
    }
    const { id: clientId } = resClient[0];
    return Promise.resolve(clientId);
}
