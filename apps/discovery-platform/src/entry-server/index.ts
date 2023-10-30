import { Pool } from 'pg';
import express from 'express';
import { v1Router } from './routers/v1';
import compression from 'compression';

const app = express();

export const entryServer = (ops: {
    dbPool: Pool;
    // @ts-ignore
    secrets: Secrets;
    url: string;
}) => {
    app.use(compression());

    app.set('trust proxy', 1);
    app.use('/api/v1', v1Router(ops));

    return app;
};
