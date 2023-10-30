import { Utils } from '@rpch/sdk';
import type { Pool } from 'pg';
import type { Request, Response } from 'express';
import { ParamSchema } from 'express-validator';

import * as node from '../../../node';

const log = Utils.logger(['discovery-platform', 'router', 'node']);

export const createSchema: Record<keyof node.NodeAttrs, ParamSchema> = {
    id: {
        in: 'body',
        isString: true,
    },
    chainId: {
        in: 'body',
        isNumeric: true,
        toInt: true,
    },
    isExitNode: {
        in: 'body',
        isBoolean: true,
        toBoolean: true,
    },
    hoprdApiEndpoint: {
        in: 'body',
        isString: true,
    },
    hoprdApiToken: {
        in: 'body',
        isString: true,
    },
    nativeAddress: {
        in: 'body',
        isString: true,
    },
    exitNodePubKey: {
        in: 'body',
        isString: true,
        optional: true,
    },
};

export function create(dbPool: Pool) {
    return function (req: Request, res: Response) {
        const isExit = req.body.isExitNode;
        if (isExit && !req.body.exitNodePubKey) {
            return res.status(400).json({ errors: { exitNodePubKey: 'missing on exit node' } });
        }

        node.createNode(dbPool, req.body)
            .then((_qRes) => {
                if (isExit) {
                    node.createToken(dbPool, req.body.id)
                        .then((rows) => {
                            res.status(201).json(rows[0]);
                        })
                        .catch((err) => {
                            log.error('Error during token create query', err);
                            res.status(500).end();
                        });
                } else {
                    res.status(204).end();
                }
            })
            .catch((err) => {
                log.error('Error during node create query', err);
                res.status(500).end();
            });
    };
}
